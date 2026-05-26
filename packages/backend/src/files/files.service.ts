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

  async renameFile(userId: string, fileId: string, name: string) {
    const file = await this.prisma.file.findFirst({
      where: { id: fileId, userId, deletedAt: null },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    const updated = await this.prisma.file.update({
      where: { id: fileId },
      data: { name },
      select: { id: true, name: true, size: true, mimeType: true, folderId: true, createdAt: true },
    });

    return {
      ...updated,
      size: updated.size.toString(),
      createdAt: updated.createdAt.toISOString(),
    };
  }

  async moveFile(userId: string, fileId: string, folderId: string | null) {
    const file = await this.prisma.file.findFirst({
      where: { id: fileId, userId, deletedAt: null },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    if (folderId) {
      const folder = await this.prisma.folder.findFirst({
        where: { id: folderId, userId },
      });
      if (!folder) {
        throw new NotFoundException('Target folder not found');
      }
    }

    const updated = await this.prisma.file.update({
      where: { id: fileId },
      data: { folderId },
      select: { id: true, name: true, size: true, mimeType: true, folderId: true, createdAt: true },
    });

    return {
      ...updated,
      size: updated.size.toString(),
      createdAt: updated.createdAt.toISOString(),
    };
  }

  // --- Batch operations ---

  async batchDelete(userId: string, ids: string[]) {
    const count = await this.prisma.file.updateMany({
      where: { id: { in: ids }, userId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return { deleted: count.count };
  }

  async batchMove(userId: string, ids: string[], folderId: string | null) {
    if (folderId) {
      const folder = await this.prisma.folder.findFirst({
        where: { id: folderId, userId },
      });
      if (!folder) throw new NotFoundException('Target folder not found');
    }

    const count = await this.prisma.file.updateMany({
      where: { id: { in: ids }, userId, deletedAt: null },
      data: { folderId },
    });
    return { moved: count.count };
  }

  async batchRestore(userId: string, ids: string[]) {
    const count = await this.prisma.file.updateMany({
      where: { id: { in: ids }, userId, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
    return { restored: count.count };
  }

  async batchPurge(userId: string, ids: string[]) {
    const files = await this.prisma.file.findMany({
      where: { id: { in: ids }, userId, deletedAt: { not: null } },
    });

    for (const file of files) {
      const filePath = path.join(this.uploadRoot, 'files', userId, file.storageKey);
      import('fs/promises').then(fs => fs.unlink(filePath).catch(() => {}));
    }

    const count = await this.prisma.file.deleteMany({
      where: { id: { in: ids }, userId, deletedAt: { not: null } },
    });
    return { purged: count.count };
  }
}
