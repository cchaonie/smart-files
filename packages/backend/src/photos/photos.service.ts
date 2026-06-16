import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { createHash } from 'node:crypto';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { v4 as uuidv4 } from 'uuid';
import * as exifr from 'exifr';

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
   * Format: {PHOTO_ROOT}/{username}[/{deviceModel}]/{YYYY}/{MM}/{uuid}.{ext}
   */
  buildStoragePath(
    username: string,
    date: Date,
    ext: string,
    deviceModel?: string,
  ): { relativePath: string; absolutePath: string; dir: string } {
    const yyyy = date.getFullYear().toString();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const fileName = `${uuidv4()}.${ext}`;
    const deviceSegment = deviceModel ? path.posix.join(deviceModel) : '';
    const relativePath = deviceSegment
      ? path.posix.join(username, deviceSegment, yyyy, mm, fileName)
      : path.posix.join(username, yyyy, mm, fileName);
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
    captureDate?: string,
    deviceModel?: string,
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

    // Determine capturedAt: client-provided > EXIF > server time
    let capturedAt: Date;
    if (captureDate) {
      capturedAt = new Date(captureDate);
    } else {
      try {
        const exif = await exifr.parse(buffer, ['DateTimeOriginal']);
        if (exif?.DateTimeOriginal) {
          capturedAt = new Date(exif.DateTimeOriginal);
        } else {
          capturedAt = new Date();
        }
      } catch {
        capturedAt = new Date();
      }
    }

    // Determine storage path
    const ext = path.extname(originalName).replace(/^\\./, '') || 'bin';
    const { relativePath, absolutePath, dir } = this.buildStoragePath(
      username,
      capturedAt,
      ext,
      deviceModel,
    );

    // Find or create device folder in Files if deviceModel is provided
    let deviceFolderId: string | null = null;
    if (deviceModel) {
      const existingFolder = await this.prisma.folder.findFirst({
        where: { userId, name: deviceModel, parentId: null },
      });
      if (existingFolder) {
        deviceFolderId = existingFolder.id;
      } else {
        const newFolder = await this.prisma.folder.create({
          data: { userId, name: deviceModel, parentId: null },
        });
        deviceFolderId = newFolder.id;
      }
    }

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
        capturedAt,
        status: 'PROCESSING',
      },
    });

    // Also create a File record so photos appear in the Files tab
    await this.prisma.file.create({
      data: {
        userId,
        name: originalName,
        storageKey: relativePath,
        size: BigInt(size),
        mimeType,
        photoId: photo.id,
        folderId: deviceFolderId,
        deletedAt: null,
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

  /**
   * List photos for a user with cursor-based pagination.
   * Ordered by capturedAt DESC NULLS LAST, createdAt DESC.
   */
  async list(
    userId: string,
    cursor?: string,
    limit?: number,
    tags?: string[],
  ) {
    const take = Math.min(limit ?? 20, 100);

    // Build where clause
    const where: any = { userId };

    if (tags && tags.length > 0) {
      where.tags = { some: { tag: { in: tags } } };
    }

    if (cursor) {
      const cursorRecord = await this.prisma.photo.findUnique({
        where: { id: cursor, userId },
      });
      if (!cursorRecord) {
        throw new NotFoundException('Invalid cursor');
      }
      where.OR = [
        { capturedAt: { lt: cursorRecord.capturedAt } },
        { capturedAt: cursorRecord.capturedAt, id: { lt: cursorRecord.id } },
        { capturedAt: null, createdAt: { lt: cursorRecord.createdAt } },
      ];
    }

    // Fetch one extra record to determine if there is a next page
    const photos = await this.prisma.photo.findMany({
      where,
      orderBy: [
        { capturedAt: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      take: take + 1,
      include: { tags: true },
    });

    const hasMore = photos.length > take;
    const items = hasMore ? photos.slice(0, take) : photos;

    // Count total
    const total = await this.prisma.photo.count({ where: { userId } });

    // Map response
    const mapped = items.map((photo) => ({
      id: photo.id,
      originalName: photo.originalName,
      mimeType: photo.mimeType,
      fileSize: photo.size,
      width: photo.width,
      height: photo.height,
      thumbnailPath: `/api/photos/${photo.id}/thumbnail`,
      previewPath: `/api/photos/${photo.id}/preview`,
      capturedAt: photo.capturedAt,
      status: photo.status,
      tags: photo.tags.map((t) => ({ tag: t.tag, confidence: t.confidence })),
    }));

    return {
      photos: mapped,
      nextCursor: hasMore ? items[items.length - 1].id : null,
      total,
    };
  }

  /**
   * Get tag usage statistics for a user, with optional autocomplete search.
   */
  async getTags(userId: string, q?: string) {
    const where: any = { photo: { userId } };

    if (q) {
      where.tag = { contains: q, mode: 'insensitive' };
    }

    const results = await this.prisma.photoTag.groupBy({
      by: ['tag'],
      where,
      _count: { tag: true },
      orderBy: { _count: { tag: 'desc' } },
    });

    let tags = results.map((r) => ({
      tag: r.tag,
      count: r._count.tag,
    }));

    if (q) {
      tags = tags.slice(0, 10);
    }

    return { tags };
  }

  /**
   * Find a photo by ID, verifying ownership.
   */
  async findById(photoId: string, userId: string) {
    const photo = await this.prisma.photo.findUnique({
      where: { id: photoId },
      include: { tags: true },
    });

    if (!photo || photo.userId !== userId) {
      throw new NotFoundException('Photo not found');
    }

    return {
      id: photo.id,
      originalName: photo.originalName,
      mimeType: photo.mimeType,
      fileSize: photo.size,
      width: photo.width,
      height: photo.height,
      thumbnailPath: `/api/photos/${photo.id}/thumbnail`,
      previewPath: `/api/photos/${photo.id}/preview`,
      capturedAt: photo.capturedAt,
      status: photo.status,
      tags: photo.tags.map((t) => ({ tag: t.tag, confidence: t.confidence })),
    };
  }

  /**
   * Add a manual tag to a photo. Confidence is null for user-added tags.
   * New tags become available in the tag cloud and autocomplete immediately.
   */
  async addTag(photoId: string, userId: string, tag: string) {
    // Verify ownership
    const photo = await this.prisma.photo.findUnique({
      where: { id: photoId },
    });
    if (!photo || photo.userId !== userId) {
      throw new NotFoundException('Photo not found');
    }

    try {
      const photoTag = await this.prisma.photoTag.create({
        data: { photoId, tag, confidence: null },
      });
      return { tag: photoTag.tag };
    } catch (e: any) {
      // Unique constraint violation — tag already exists on this photo
      if (e.code === 'P2002') {
        throw new ConflictException(`Tag "${tag}" already exists on this photo`);
      }
      throw e;
    }
  }

  /**
   * Remove a manual tag from a photo.
   */
  async removeTag(photoId: string, userId: string, tag: string) {
    // Verify ownership
    const photo = await this.prisma.photo.findUnique({
      where: { id: photoId },
    });
    if (!photo || photo.userId !== userId) {
      throw new NotFoundException('Photo not found');
    }

    const result = await this.prisma.photoTag.deleteMany({
      where: { photoId, tag },
    });

    if (result.count === 0) {
      throw new NotFoundException(`Tag "${tag}" not found on this photo`);
    }

    return { removed: tag };
  }

  /**
   * Batch delete photos by IDs.
   * Also soft-deletes associated File records so they appear in trash.
   */
  async batchDelete(ids: string[], userId: string) {
    // Verify all photos belong to user
    const photos = await this.prisma.photo.findMany({
      where: { id: { in: ids }, userId },
      include: { file: true },
    });

    if (photos.length !== ids.length) {
      throw new NotFoundException('One or more photos not found');
    }

    // Soft-delete associated File records
    const fileIds = photos.filter(p => p.file?.id).map(p => p.file!.id);
    if (fileIds.length > 0) {
      await this.prisma.file.updateMany({
        where: { id: { in: fileIds } },
        data: { deletedAt: new Date() },
      });
    }

    // Delete Photo records (cascades to PhotoTag, AlbumPhotoMember; sets File.photoId to null)
    await this.prisma.photo.deleteMany({
      where: { id: { in: ids }, userId },
    });

    return { deleted: ids.length };
  }

  /**
   * Get a readable stream for a photo's thumbnail file.
   * Returns the stream and mime type.
   */
  async getThumbnailStream(photoId: string, userId: string) {
    const photo = await this.prisma.photo.findUnique({
      where: { id: photoId },
    });

    if (!photo || photo.userId !== userId || !photo.thumbnailPath) {
      throw new NotFoundException('Photo not found');
    }

    const absolutePath = path.resolve(this.photoRoot, photo.thumbnailPath);
    if (!absolutePath.startsWith(this.photoRoot)) {
      throw new NotFoundException('Invalid photo path');
    }

    try {
      await fs.access(absolutePath);
    } catch {
      throw new NotFoundException('Photo file not found on disk');
    }

    const stream = createReadStream(absolutePath);
    return { stream, mimeType: 'image/webp' };
  }

  /**
   * Get a readable stream for a photo's preview file.
   * Returns the stream and mime type.
   */
  async getPreviewStream(photoId: string, userId: string) {
    const photo = await this.prisma.photo.findUnique({
      where: { id: photoId },
    });

    if (!photo || photo.userId !== userId || !photo.previewPath) {
      throw new NotFoundException('Photo not found');
    }

    const absolutePath = path.resolve(this.photoRoot, photo.previewPath);
    if (!absolutePath.startsWith(this.photoRoot)) {
      throw new NotFoundException('Invalid photo path');
    }

    try {
      await fs.access(absolutePath);
    } catch {
      throw new NotFoundException('Photo file not found on disk');
    }

    const stream = createReadStream(absolutePath);
    return { stream, mimeType: 'image/jpeg' };
  }
}
