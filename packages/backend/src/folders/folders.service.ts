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

  async deleteFolder(userId: string, id: string) {
    const folder = await this.prisma.folder.findFirst({
      where: { id, userId },
      include: {
        files: true,
        children: true,
      },
    });

    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    if (folder.files.length > 0 || folder.children.length > 0) {
      throw new ConflictException('Folder must be empty before deletion');
    }

    await this.prisma.folder.delete({ where: { id } });

    return { success: true };
  }
}
