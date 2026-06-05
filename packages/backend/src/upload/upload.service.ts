import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RequestLike } from '../common/types/http';
import { createWriteStream, createReadStream } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';
import { CreateSessionDto } from './dto';

@Injectable()
export class UploadService {
  private uploadRoot: string;

  constructor(private prisma: PrismaService) {
    this.uploadRoot = process.env.UPLOAD_ROOT || './data/storage';
  }

  /**
   * Sanitize a filename for safe filesystem use:
   * - Strip path separators and null bytes
   * - Remove leading dots/dashes to prevent hidden files / CLI injection
   * - Collapse whitespace runs
   * - Truncate to 200 chars (leaving room for counter suffix)
   */
  private sanitizeFileName(name: string): string {
    let safe = name
      .replace(/[/\\\0<>:"|?*]/g, '_')     // Replace dangerous chars with _
      .replace(/^[ ._-]+/, '')              // Strip leading dots/dashes/underscores/spaces
      .replace(/\s+/g, ' ')                 // Collapse whitespace
      .trim();

    if (!safe) safe = 'unnamed';

    // Keep extension intact, truncate base name to 200 chars max
    const ext = path.extname(safe);
    const base = path.basename(safe, ext);
    return base.slice(0, 200) + ext;
  }

  /**
   * Resolve a storage path for the given userId + filename, handling collisions
   * by appending a numeric suffix (e.g. "photo (1).jpg").
   */
  private async resolveStoragePath(userId: string, fileName: string): Promise<string> {
    const safeName = this.sanitizeFileName(fileName);
    const userDir = path.join(this.uploadRoot, 'files', userId);
    await fs.mkdir(userDir, { recursive: true });

    let storageKey = safeName;
    let destPath = path.join(userDir, storageKey);
    let counter = 1;

    while (true) {
      try {
        await fs.access(destPath);
        // File exists — append counter suffix
        const ext = path.extname(safeName);
        const base = path.basename(safeName, ext);
        storageKey = `${base} (${counter})${ext}`;
        destPath = path.join(userDir, storageKey);
        counter++;
      } catch {
        // File doesn't exist — good to use
        break;
      }
    }

    return destPath;
  }

  async createSession(userId: string, dto: CreateSessionDto) {
    const totalSize = BigInt(dto.totalSize);

    // Validate file size
    const maxSize = BigInt(process.env.MAX_FILE_SIZE_BYTES || 10 * 1024 * 1024 * 1024);
    if (totalSize > maxSize) {
      throw new BadRequestException('File too large');
    }

    // Validate folder if provided
    if (dto.folderId) {
      const folder = await this.prisma.folder.findFirst({
        where: { id: dto.folderId, userId },
      });
      if (!folder) {
        throw new NotFoundException('Folder not found');
      }
    }

    const chunkSize = dto.chunkSize || 5 * 1024 * 1024;
    const totalChunks = Math.ceil(Number(totalSize) / chunkSize);

    const session = await this.prisma.uploadSession.create({
      data: {
        userId,
        folderId: dto.folderId || null,
        fileName: dto.fileName,
        totalSize,
        chunkSize,
        receivedChunkIndexes: [],
        status: 'pending',
      },
    });

    // Create temp directory
    const tempDir = path.join(this.uploadRoot, 'tmp', userId, session.id);
    await fs.mkdir(tempDir, { recursive: true });

    return {
      uploadId: session.id,
      chunkSize,
      totalChunks,
      totalSize: session.totalSize.toString(),
    };
  }

  async getSession(userId: string, sessionId: string) {
    const session = await this.prisma.uploadSession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    const totalChunks = Math.ceil(Number(session.totalSize) / session.chunkSize);

    return {
      receivedIndexes: session.receivedChunkIndexes,
      totalChunks,
      chunkSize: session.chunkSize,
      totalSize: session.totalSize.toString(),
    };
  }

  async uploadChunk(userId: string, sessionId: string, chunkIndex: number, req: RequestLike) {
    const session = await this.prisma.uploadSession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.status !== 'pending') {
      throw new BadRequestException('Upload already completed or failed');
    }

    const totalChunks = Math.ceil(Number(session.totalSize) / session.chunkSize);
    if (chunkIndex < 0 || chunkIndex >= totalChunks) {
      throw new BadRequestException('Invalid chunk index');
    }

    const tempDir = path.join(this.uploadRoot, 'tmp', userId, sessionId);
    const chunkPath = path.join(tempDir, String(chunkIndex));

    // bodyParser.raw() already consumed the stream into req.body — write directly
    const buffer = req.body as Buffer;
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('Empty chunk data');
    }
    await fs.writeFile(chunkPath, buffer);

    // Update received chunks
    const receivedIndexes = session.receivedChunkIndexes || [];
    if (!receivedIndexes.includes(chunkIndex)) {
      receivedIndexes.push(chunkIndex);
      receivedIndexes.sort((a, b) => a - b);

      await this.prisma.uploadSession.update({
        where: { id: sessionId },
        data: { receivedChunkIndexes: receivedIndexes },
      });
    }

    return { success: true, received: receivedIndexes.length };
  }

  async completeUpload(userId: string, sessionId: string, mimeType?: string) {
    const session = await this.prisma.uploadSession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    const totalChunks = Math.ceil(Number(session.totalSize) / session.chunkSize);
    const received = session.receivedChunkIndexes || [];

    // Verify all chunks received
    if (received.length !== totalChunks) {
      throw new BadRequestException('Incomplete upload');
    }

    // Verify chunk indices
    for (let i = 0; i < totalChunks; i++) {
      if (!received.includes(i)) {
        throw new BadRequestException('Missing chunk');
      }
    }

    // Merge chunks
    const destPath = await this.resolveStoragePath(userId, session.fileName);
    const storageKey = path.basename(destPath);
    await fs.mkdir(path.dirname(destPath), { recursive: true });

    const tempDir = path.join(this.uploadRoot, 'tmp', userId, sessionId);

    try {
      await this.mergeChunks(tempDir, totalChunks, destPath);
    } catch (error) {
      await fs.unlink(destPath).catch(() => {});
      throw new BadRequestException('Failed to merge chunks');
    }

    // Verify size
    const stats = await fs.stat(destPath);
    if (BigInt(stats.size) !== session.totalSize) {
      await fs.unlink(destPath).catch(() => {});
      throw new BadRequestException('Size mismatch after merge');
    }

    // Create file record
    const file = await this.prisma.$transaction(async (tx: any) => {
      const created = await tx.file.create({
        data: {
          userId,
          folderId: session.folderId,
          name: session.fileName,
          storageKey,
          size: session.totalSize,
          mimeType: mimeType || null,
        },
      });

      await tx.uploadSession.update({
        where: { id: sessionId },
        data: { status: 'completed' },
      });

      return created;
    });

    // Cleanup temp files
    for (let i = 0; i < totalChunks; i++) {
      await fs.unlink(path.join(tempDir, String(i))).catch(() => {});
    }
    await fs.rm(tempDir, { recursive: true }).catch(() => {});

    return {
      file: {
        id: file.id,
        name: file.name,
        size: file.size.toString(),
        createdAt: file.createdAt.toISOString(),
      },
    };
  }

  private async mergeChunks(chunkDir: string, totalChunks: number, destPath: string) {
    const writeStream = createWriteStream(destPath);

    try {
      for (let i = 0; i < totalChunks; i++) {
        const chunkPath = path.join(chunkDir, String(i));
        const readStream = createReadStream(chunkPath);

        await new Promise<void>((resolve, reject) => {
          readStream.pipe(writeStream, { end: false });
          readStream.on('end', resolve);
          readStream.on('error', reject);
        });
      }

      writeStream.end();
      await new Promise<void>((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });
    } catch (error) {
      writeStream.destroy();
      throw error;
    }
  }
}
