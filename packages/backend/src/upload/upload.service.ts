import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RequestLike } from '../common/types/http';
import { createWriteStream, createReadStream } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';
import { CreateSessionDto } from './dto';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
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

    // If completed, fetch the associated file record
    let file: { id: string; name: string; size: string } | null = null;
    if (session.status === 'completed') {
      const fileRecord = await this.prisma.file.findFirst({
        where: { userId, name: session.fileName },
        orderBy: { createdAt: 'desc' },
      });
      if (fileRecord) {
        file = {
          id: fileRecord.id,
          name: fileRecord.name,
          size: fileRecord.size.toString(),
        };
      }
    }

    return {
      status: session.status,
      receivedIndexes: session.receivedChunkIndexes,
      totalChunks,
      chunkSize: session.chunkSize,
      totalSize: session.totalSize.toString(),
      file,
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

    if (session.status === 'completed') {
      return { status: 'completed' };
    }
    if (session.status === 'failed') {
      throw new BadRequestException('Upload previously failed');
    }

    const totalChunks = Math.ceil(Number(session.totalSize) / session.chunkSize);
    const received = session.receivedChunkIndexes || [];

    // Verify all chunks received
    if (received.length !== totalChunks) {
      throw new BadRequestException('Incomplete upload');
    }
    for (let i = 0; i < totalChunks; i++) {
      if (!received.includes(i)) {
        throw new BadRequestException('Missing chunk');
      }
    }

    // Mark as merging and return immediately
    await this.prisma.uploadSession.update({
      where: { id: sessionId },
      data: { status: 'merging' },
    });

    // Start background merge — do not await
    this.processComplete(session, mimeType).catch((err) => {
      this.logger.error(`Background merge failed for session ${sessionId}: ${err.message}`);
    });

    return { status: 'merging' };
  }

  async cancelSession(userId: string, sessionId: string) {
    const session = await this.prisma.uploadSession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.status === 'completed') {
      throw new BadRequestException('Cannot cancel a completed upload');
    }

    // Mark as failed
    await this.prisma.uploadSession.update({
      where: { id: sessionId },
      data: { status: 'failed' },
    });

    // Clean up temp chunk files
    const tempDir = path.join(this.uploadRoot, 'tmp', userId, sessionId);
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});

    this.logger.log(`Upload session cancelled: ${sessionId} (${session.fileName})`);
    return { status: 'cancelled' };
  }

  private async processComplete(session: any, mimeType?: string) {
    const sessionId = session.id;
    const userId = session.userId;
    const totalChunks = Math.ceil(Number(session.totalSize) / session.chunkSize);

    const tempDir = path.join(this.uploadRoot, 'tmp', userId, sessionId);

    try {
      const safeName = this.sanitizeFileName(session.fileName);

      // Merge chunks to a temporary merged file first
      const mergedPath = path.join(tempDir, '.merged');
      await this.mergeChunks(tempDir, totalChunks, mergedPath);

      // Verify size before entering the transaction
      const stats = await fs.stat(mergedPath);
      if (BigInt(stats.size) !== session.totalSize) {
        await fs.unlink(mergedPath).catch(() => {});
        throw new Error('Size mismatch after merge');
      }

      // Quick transaction: DB-level dedup only (no filesystem ops inside)
      let storageKey: string;
      try {
        const result = await this.prisma.$transaction(async (tx: any) => {
          const ext = path.extname(safeName);
          const base = path.basename(safeName, ext);

          let sk = safeName;
          let counter = 1;
          while (true) {
            const existing = await tx.file.findFirst({
              where: { userId, storageKey: sk },
            });
            if (!existing) break;
            sk = `${base} (${counter})${ext}`;
            counter++;
          }

          const created = await tx.file.create({
            data: {
              userId,
              folderId: session.folderId,
              name: session.fileName,
              storageKey: sk,
              size: session.totalSize,
              mimeType: mimeType || null,
            },
          });

          await tx.uploadSession.update({
            where: { id: sessionId },
            data: { status: 'completed' },
          });

          return { storageKey: sk };
        });
        storageKey = result.storageKey;
      } catch (err: any) {
        // Unique constraint violation (P2002) — concurrent upload won the race,
        // retry once with the next counter
        if (err?.code === 'P2002') {
          const ext = path.extname(safeName);
          const base = path.basename(safeName, ext);
          storageKey = `${base} (${Date.now()})${ext}`;
          // Create the File record outside the transaction with a timestamp-guaranteed unique key
          await this.prisma.file.create({
            data: {
              userId,
              folderId: session.folderId,
              name: session.fileName,
              storageKey,
              size: session.totalSize,
              mimeType: mimeType || null,
            },
          });
          await this.prisma.uploadSession.update({
            where: { id: sessionId },
            data: { status: 'completed' },
          });
        } else {
          throw err;
        }
      }

      // Atomic rename (outside transaction — filesystem can't roll back)
      const destDir = path.join(this.uploadRoot, 'files', userId);
      await fs.mkdir(destDir, { recursive: true });
      const destPath = path.join(destDir, storageKey);
      await fs.rename(mergedPath, destPath);

      // Cleanup temp files
      for (let i = 0; i < totalChunks; i++) {
        await fs.unlink(path.join(tempDir, String(i))).catch(() => {});
      }
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});

      this.logger.log(`Upload completed: ${storageKey} (${session.totalSize})`);
    } catch (error) {
      // Mark session as failed
      await this.prisma.uploadSession
        .update({
          where: { id: sessionId },
          data: { status: 'failed' },
        })
        .catch(() => {});
      this.logger.error(`Failed to process upload ${sessionId}: ${error.message}`);
    }
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
