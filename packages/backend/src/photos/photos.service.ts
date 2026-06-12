import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { createHash } from 'node:crypto';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PhotosService {
  private readonly photoRoot: string;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    @InjectQueue('photo-thumbnail') private thumbnailQueue: Queue,
    @InjectQueue('ai-tagging') private aiTaggingQueue: Queue,
  ) {
    this.photoRoot =
      this.configService.get<string>('PHOTO_ROOT') || '/mnt/pool';
  }

  /**
   * Compute SHA-256 hash of a Buffer.
   */
  computeHash(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Build the storage path for a photo.
   * Format: {PHOTO_ROOT}/{username}/{YYYY}/{MM}/{uuid}.{ext}
   */
  buildStoragePath(
    username: string,
    date: Date,
    ext: string,
  ): { relativePath: string; absolutePath: string; dir: string } {
    const yyyy = date.getFullYear().toString();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const fileName = `${uuidv4()}.${ext}`;
    const relativePath = path.join(username, yyyy, mm, fileName);
    const absolutePath = path.join(this.photoRoot, relativePath);
    const dir = path.dirname(absolutePath);
    return { relativePath, absolutePath, dir };
  }

  /**
   * Ensure the directory exists (create recursively).
   */
  async ensureDir(dir: string): Promise<void> {
    await fs.mkdir(dir, { recursive: true });
  }

  /**
   * Upload a photo file.
   * Returns the Photo record — either existing (dedup) or newly created.
   */
  async upload(
    userId: string,
    username: string,
    originalName: string,
    mimeType: string,
    buffer: Buffer,
  ): Promise<{ id: string; status: string }> {
    const hash = this.computeHash(buffer);
    const size = buffer.length;

    // Dedup: check if a Photo with this hash already exists for this user
    const existing = await this.prisma.photo.findFirst({
      where: { userId, hash },
    });
    if (existing) {
      return { id: existing.id, status: existing.status };
    }

    // Determine storage path
    const ext = path.extname(originalName).replace(/^\./, '') || 'bin';
    const now = new Date();
    const { relativePath, absolutePath, dir } = this.buildStoragePath(
      username,
      now,
      ext,
    );

    // Write file
    await this.ensureDir(dir);
    await fs.writeFile(absolutePath, buffer);

    // Create Photo record
    const photo = await this.prisma.photo.create({
      data: {
        userId,
        originalName,
        mimeType,
        size,
        hash,
        storageKey: relativePath,
        capturedAt: now,
        status: 'PROCESSING',
      },
    });

    // Enqueue async jobs
    await this.thumbnailQueue.add('process', { photoId: photo.id });
    await this.aiTaggingQueue.add('process', { photoId: photo.id });

    return { id: photo.id, status: photo.status };
  }

  /**
   * Retry processing a failed photo.
   * Resets status to PROCESSING and re-enqueues the thumbnail job.
   */
  async retry(
    photoId: string,
    userId: string,
  ): Promise<{ id: string; status: string }> {
    const photo = await this.prisma.photo.findUnique({
      where: { id: photoId },
    });

    if (!photo) {
      throw new NotFoundException('Photo not found');
    }

    if (photo.userId !== userId) {
      throw new NotFoundException('Photo not found');
    }

    if (photo.status !== 'FAILED') {
      throw new ConflictException('Photo is not in FAILED status');
    }

    await this.prisma.photo.update({
      where: { id: photoId },
      data: { status: 'PROCESSING' },
    });

    await this.thumbnailQueue.add('process', { photoId });

    return { id: photoId, status: 'PROCESSING' };
  }
}
