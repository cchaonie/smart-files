import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import * as path from 'path';

@Injectable()
export class FilesService {
  private uploadRoot: string;

  constructor(private prisma: PrismaService) {
    this.uploadRoot = process.env.UPLOAD_ROOT || './data/storage';
  }

  async listFiles(userId: string, folderId?: string) {
    const files = await this.prisma.file.findMany({
      where: {
        userId,
        ...(folderId !== undefined ? { folderId: folderId || null } : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        size: true,
        mimeType: true,
        folderId: true,
        createdAt: true,
      },
    });

    return {
      files: files.map((f) => ({
        ...f,
        size: f.size.toString(),
        createdAt: f.createdAt.toISOString(),
      })),
    };
  }

  async deleteFile(userId: string, fileId: string) {
    const file = await this.prisma.file.findFirst({
      where: { id: fileId, userId },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    await this.prisma.file.delete({ where: { id: fileId } });

    // Delete physical file (async, don't wait)
    const filePath = path.join(this.uploadRoot, 'files', userId, file.storageKey);
    import('fs/promises').then(fs => fs.unlink(filePath).catch(() => {}));

    return { success: true };
  }

  async downloadFile(userId: string, fileId: string) {
    const file = await this.prisma.file.findFirst({
      where: { id: fileId, userId },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    const filePath = path.join(this.uploadRoot, 'files', userId, file.storageKey);

    try {
      await stat(filePath);
    } catch {
      throw new NotFoundException('File content not found');
    }

    return {
      stream: createReadStream(filePath),
      filename: file.name,
      mimeType: file.mimeType,
    };
  }

  async previewFile(userId: string, fileId: string) {
    const file = await this.prisma.file.findFirst({
      where: { id: fileId, userId },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    const filePath = path.join(this.uploadRoot, 'files', userId, file.storageKey);

    try {
      await stat(filePath);
    } catch {
      throw new NotFoundException('File content not found');
    }

    return {
      stream: createReadStream(filePath),
      mimeType: file.mimeType,
      size: Number(file.size),
      path: filePath,
    };
  }
}
