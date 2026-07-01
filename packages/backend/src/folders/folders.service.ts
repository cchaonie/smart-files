import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FoldersService {
  constructor(private prisma: PrismaService) {}

  async browse(userId: string, parentId?: string) {
    const folderId = parentId !== undefined ? (parentId || null) : undefined;

    const [folders, files] = await Promise.all([
      this.prisma.folder.findMany({
        where: {
          userId,
          parentId: folderId,
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          createdAt: true,
        },
      }),
      this.prisma.file.findMany({
        where: {
          userId,
          folderId,
          deletedAt: null,
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
      }),
    ]);

    return {
      folders: folders.map((f) => ({
        ...f,
        createdAt: f.createdAt.toISOString(),
      })),
      files: files.map((f) => ({
        ...f,
        size: f.size.toString(),
        createdAt: f.createdAt.toISOString(),
        photoId: f.photoId ?? undefined,
      })),
    };
  }

  async createFolder(userId: string, name: string, parentId?: string) {
    if (parentId) {
      const parent = await this.prisma.folder.findFirst({
        where: { id: parentId, userId },
      });
      if (!parent) {
        throw new NotFoundException('Parent folder not found');
      }
    }

    const folder = await this.prisma.folder.create({
      data: {
        name,
        userId,
        parentId: parentId || null,
      },
    });

    return {
      id: folder.id,
      name: folder.name,
      createdAt: folder.createdAt.toISOString(),
    };
  }

  async renameFolder(userId: string, id: string, name: string) {
    const folder = await this.prisma.folder.findFirst({
      where: { id, userId },
    });

    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    const updated = await this.prisma.folder.update({
      where: { id },
      data: { name },
    });

    return {
      id: updated.id,
      name: updated.name,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  async getFolderPath(userId: string, id: string): Promise<{ id: string; name: string }[]> {
    const folder = await this.prisma.folder.findFirst({
      where: { id, userId },
    });
    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    // Walk up the parent chain to build root → folder path
    const path: { id: string; name: string }[] = [];
    let current: { id: string; name: string; parentId: string | null } | null = folder;
    while (current) {
      path.unshift({ id: current.id, name: current.name });
      if (!current.parentId) break;
      current = await this.prisma.folder.findFirst({
        where: { id: current.parentId, userId },
        select: { id: true, name: true, parentId: true },
      });
    }
    return path;
  }

  /**
   * Create a folder tree from relative paths under a root parent.
   * Returns a map of relative path → folderId.
   *
   * Example:
   *   createFolderTree(userId, null, ['photos/2024/vacation', 'photos/2024/birthday'])
   *   → { 'photos': '<id>', 'photos/2024': '<id>', 'photos/2024/vacation': '<id>', 'photos/2024/birthday': '<id>' }
   */
  async createFolderTree(
    userId: string,
    parentId: string | null,
    relativePaths: string[],
  ): Promise<Record<string, string>> {
    // Collect all unique ancestor paths (not just the leaf paths)
    const allPaths = new Set<string>();
    for (const relPath of relativePaths) {
      const parts = relPath.split('/').filter(Boolean);
      for (let i = 1; i <= parts.length; i++) {
        allPaths.add(parts.slice(0, i).join('/'));
      }
    }

    const sortedPaths = [...allPaths].sort((a, b) => a.split('/').length - b.split('/').length);
    const pathToId: Record<string, string> = {};

    for (const relPath of sortedPaths) {
      const parts = relPath.split('/');
      const name = parts[parts.length - 1];
      const parentRelPath = parts.slice(0, -1).join('/');
      const parentFolderId = parentRelPath ? pathToId[parentRelPath] : parentId;

      // Check if folder already exists under the same parent
      const existing = await this.prisma.folder.findFirst({
        where: { userId, name, parentId: parentFolderId ?? null },
      });

      if (existing) {
        pathToId[relPath] = existing.id;
      } else {
        const folder = await this.prisma.folder.create({
          data: { name, userId, parentId: parentFolderId ?? null },
        });
        pathToId[relPath] = folder.id;
      }
    }

    return pathToId;
  }

  async deleteFolder(userId: string, id: string) {
    const folder = await this.prisma.folder.findFirst({
      where: { id, userId },
      include: {
        files: true, // include all files (including soft-deleted)
        children: true,
      },
    });

    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    // Check for active (non-deleted) files — those must be removed first
    const activeFiles = folder.files.filter(f => f.deletedAt === null);
    if (activeFiles.length > 0 || folder.children.length > 0) {
      throw new ConflictException('Folder must be empty before deletion');
    }

    // Nullify folderId on soft-deleted files to release FK constraint
    if (folder.files.length > 0) {
      await this.prisma.file.updateMany({
        where: { folderId: id },
        data: { folderId: null },
      });
    }

    await this.prisma.folder.delete({ where: { id } });

    return { success: true };
  }
}
