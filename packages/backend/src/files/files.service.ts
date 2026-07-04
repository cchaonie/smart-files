import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import * as path from 'path';

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);
  private uploadRoot: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.uploadRoot = this.configService.get<string>('UPLOAD_ROOT') || './data/storage';
  }

  /**
   * Walk up the folder tree to build a breadcrumb path string.
   * Returns ['Root'] for a null/root folderId.
   */
  private async buildFolderPath(folderId: string | null): Promise<string> {
    if (!folderId) return 'Root';
    const segments: string[] = [];
    let currentId: string | null = folderId;
    while (currentId) {
      const folder = await this.prisma.folder.findFirst({
        where: { id: currentId },
        select: { id: true, name: true, parentId: true },
      });
      if (!folder) break;
      segments.unshift(folder.name);
      currentId = folder.parentId;
    }
    segments.unshift('Root');
    return segments.join(' / ');
  }

  async checkFile(userId: string, name: string, folderId?: string) {
    const resolvedFolderId = folderId !== undefined ? (folderId || null) : undefined;
    const file = await this.prisma.file.findFirst({
      where: {
        userId,
        name,
        deletedAt: null,
        ...(resolvedFolderId !== undefined ? { folderId: resolvedFolderId } : {}),
      },
      include: { folder: { select: { id: true, name: true } } },
    });

    if (!file) return { exists: false };

    const path = await this.buildFolderPath(file.folderId);
    return {
      exists: true,
      file: {
        id: file.id,
        name: file.name,
        folderId: file.folderId,
        path,
      },
    };
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
        photoId: true,
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

    const filePath = this.resolveFilePath(file, userId);

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
        photoId: true,
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
        photoId: f.photoId ?? undefined,
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

    const filePath = this.resolveFilePath(file, userId);

    try {
      await stat(filePath);
    } catch {
      throw new NotFoundException('File content not found');
    }

    return {
      stream: createReadStream(filePath),
      mimeType: file.mimeType || 'application/octet-stream',
      size: Number(file.size),
      path: filePath,
      filename: file.name,
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

  /**
   * Resolve the absolute file path on disk for a given File record.
   * Files live under UPLOAD_ROOT.
   */
  private resolveFilePath(file: { storageKey: string }, userId: string): string {
    return path.join(this.uploadRoot, 'files', userId, file.storageKey);
  }

  async purgeFile(userId: string, fileId: string) {
    const file = await this.prisma.file.findFirst({
      where: { id: fileId, userId, deletedAt: { not: null } },
    });

    if (!file) {
      throw new NotFoundException('File not found in trash');
    }

    if (file.photoId) {
      throw new NotFoundException('Cannot purge a photo-linked file');
    }

    // Delete physical file first, then DB record
    const { unlink } = await import('fs/promises');
    await unlink(this.resolveFilePath(file, userId)).catch((e) => {
      this.logger.error(`Failed to delete file from disk: ${e.message}`);
    });
    await this.prisma.file.delete({ where: { id: fileId } });

    return { success: true };
  }

  async emptyTrash(userId: string) {
    const files = await this.prisma.file.findMany({
      where: { userId, deletedAt: { not: null } },
    });

    // Delete physical files first
    const { unlink } = await import('fs/promises');
    for (const file of files) {
      await unlink(this.resolveFilePath(file, userId)).catch((e) => {
        this.logger.error(`Failed to delete file from disk: ${e.message}`);
      });
    }

    const { count } = await this.prisma.file.deleteMany({
      where: { userId, deletedAt: { not: null } },
    });
    return { deleted: count };
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

    const { unlink } = await import('fs/promises');
    for (const file of files) {
      await unlink(this.resolveFilePath(file, userId)).catch((e) => {
        this.logger.error(`Failed to delete file from disk: ${e.message}`);
      });
    }

    const count = await this.prisma.file.deleteMany({
      where: { id: { in: files.map((f) => f.id) }, userId, deletedAt: { not: null } },
    });
    return { purged: count.count };
  }
}
