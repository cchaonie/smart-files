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
        deletedAt: null,
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
      where: { id: fileId, userId, deletedAt: null },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    // Soft delete: mark as deleted instead of removing
    await this.prisma.file.update({
      where: { id: fileId },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }

  async downloadFile(userId: string, fileId: string) {
    const file = await this.prisma.file.findFirst({
      where: { id: fileId, userId, deletedAt: null },
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

  async searchFiles(userId: string, query: string) {
    const files = await this.prisma.file.findMany({
      where: {
        userId,
        deletedAt: null,
        name: { contains: query, mode: 'insensitive' },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        size: true,
        mimeType: true,
        folderId: true,
        createdAt: true,
        folder: {
          select: { id: true, name: true },
        },
      },
      take: 50,
    });

    return {
      results: files.map((f) => ({
        ...f,
        size: f.size.toString(),
        createdAt: f.createdAt.toISOString(),
        folderName: f.folder?.name || null,
      })),
    };
  }

  async previewFile(userId: string, fileId: string) {
    const file = await this.prisma.file.findFirst({
      where: { id: fileId, userId, deletedAt: null },
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

  async listTrashFiles(userId: string) {
    const files = await this.prisma.file.findMany({
      where: {
        userId,
        deletedAt: { not: null },
      },
      orderBy: { deletedAt: 'desc' },
      select: {
        id: true,
        name: true,
        size: true,
        mimeType: true,
        folderId: true,
        deletedAt: true,
        folder: {
          select: { id: true, name: true },
        },
      },
    });

    return {
      files: files.map((f) => ({
        ...f,
        size: f.size.toString(),
        deletedAt: f.deletedAt!.toISOString(),
        folderName: f.folder?.name || null,
      })),
    };
  }

  async restoreFile(userId: string, fileId: string) {
    const file = await this.prisma.file.findFirst({
      where: { id: fileId, userId, deletedAt: { not: null } },
    });

    if (!file) {
      throw new NotFoundException('File not found in trash');
    }

    await this.prisma.file.update({
      where: { id: fileId },
      data: { deletedAt: null },
    });

    return { success: true };
  }

  async purgeFile(userId: string, fileId: string) {
    const file = await this.prisma.file.findFirst({
      where: { id: fileId, userId, deletedAt: { not: null } },
    });

    if (!file) {
      throw new NotFoundException('File not found in trash');
    }

    await this.prisma.file.delete({ where: { id: fileId } });

    // Delete physical file
    const filePath = path.join(this.uploadRoot, 'files', userId, file.storageKey);
    import('fs/promises').then(fs => fs.unlink(filePath).catch(() => {}));

    return { success: true };
  }

  async emptyTrash(userId: string) {
    const files = await this.prisma.file.findMany({
      where: { userId, deletedAt: { not: null } },
    });

    for (const file of files) {
      const filePath = path.join(this.uploadRoot, 'files', userId, file.storageKey);
      import('fs/promises').then(fs => fs.unlink(filePath).catch(() => {}));
    }

    await this.prisma.file.deleteMany({
      where: { userId, deletedAt: { not: null } },
    });

    return { deleted: files.length };
  }
}
