import { Injectable, NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AlbumsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, name: string, description?: string) {
    if (!name || !name.trim()) {
      throw new BadRequestException('Album name is required');
    }
    const album = await this.prisma.album.create({
      data: { name: name.trim(), description: description?.trim() || null, ownerId: userId },
    });
    return this.mapAlbum(album);
  }

  async list(userId: string) {
    const albums = await this.prisma.album.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { members: true } } },
    });
    return { albums: albums.map(a => this.mapAlbum(a)) };
  }

  async findById(albumId: string, userId: string) {
    const album = await this.prisma.album.findUnique({
      where: { id: albumId },
      include: { _count: { select: { members: true } } },
    });
    if (!album || album.ownerId !== userId) {
      throw new NotFoundException('Album not found');
    }
    return this.mapAlbum(album);
  }

  async update(albumId: string, userId: string, data: { name?: string; description?: string }) {
    await this.findById(albumId, userId); // ownership check
    const album = await this.prisma.album.update({
      where: { id: albumId },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
      },
      include: { _count: { select: { members: true } } },
    });
    return this.mapAlbum(album);
  }

  async delete(albumId: string, userId: string) {
    await this.findById(albumId, userId); // ownership check
    const count = await this.prisma.albumPhotoMember.count({ where: { albumId } });
    if (count > 0) {
      throw new ConflictException('Cannot delete album with photos');
    }
    await this.prisma.album.delete({ where: { id: albumId } });
  }

  // --- Sharing ---

  async share(albumId: string, ownerId: string, userId: string, role: string) {
    await this.findById(albumId, ownerId); // ownership check

    const existing = await this.prisma.sharedAlbum.findUnique({
      where: { albumId_userId: { albumId, userId } },
    });
    if (existing) {
      throw new ConflictException('Album already shared with this user');
    }

    const shared = await this.prisma.sharedAlbum.create({
      data: { albumId, userId, role },
    });
    return { id: shared.id, albumId: shared.albumId, userId: shared.userId, role: shared.role };
  }

  async unshare(albumId: string, ownerId: string, userId: string) {
    await this.findById(albumId, ownerId); // ownership check

    await this.prisma.sharedAlbum.delete({
      where: { albumId_userId: { albumId, userId } },
    });
  }

  async listShares(albumId: string, ownerId: string) {
    await this.findById(albumId, ownerId); // ownership check

    const shares = await this.prisma.sharedAlbum.findMany({
      where: { albumId },
      include: { user: { select: { id: true, name: true } } },
    });

    return {
      shares: shares.map((s) => ({
        userId: s.user.id,
        userName: s.user.name,
        role: s.role,
      })),
    };
  }

  // --- Album photo management ---

  async addPhoto(albumId: string, userId: string, photoId: string) {
    await this.ensureAlbumAccess(albumId, userId, ['CONTRIBUTOR']);

    const member = await this.prisma.albumPhotoMember.create({
      data: { albumId, photoId, addedById: userId },
    });
    return { id: member.id, albumId: member.albumId, photoId: member.photoId };
  }

  async removePhoto(albumId: string, userId: string, photoId: string) {
    await this.ensureAlbumAccess(albumId, userId, ['CONTRIBUTOR']);

    await this.prisma.albumPhotoMember.delete({
      where: { albumId_photoId: { albumId, photoId } },
    });
  }

  async listAlbumPhotos(albumId: string, userId: string) {
    await this.ensureAlbumAccess(albumId, userId);

    const members = await this.prisma.albumPhotoMember.findMany({
      where: { albumId },
      include: {
        photo: {
          include: { tags: true },
        },
      },
    });

    const photos = members.map((m) => ({
      id: m.photo.id,
      originalName: m.photo.originalName,
      mimeType: m.photo.mimeType,
      fileSize: m.photo.size,
      width: m.photo.width,
      height: m.photo.height,
      thumbnailPath: `/api/photos/${m.photo.id}/thumbnail`,
      previewPath: `/api/photos/${m.photo.id}/preview`,
      capturedAt: m.photo.capturedAt,
      status: m.photo.status,
      tags: m.photo.tags.map((t) => ({ tag: t.tag, confidence: t.confidence })),
    }));

    return { photos };
  }

  // --- Private helpers ---

  private async checkAlbumAccess(
    albumId: string,
    userId: string,
    requiredRoles?: string[],
  ): Promise<{ isOwner: boolean; role: string | null }> {
    const album = await this.prisma.album.findUnique({ where: { id: albumId } });
    if (!album) {
      throw new NotFoundException('Album not found');
    }

    if (album.ownerId === userId) {
      return { isOwner: true, role: null };
    }

    const shared = await this.prisma.sharedAlbum.findUnique({
      where: { albumId_userId: { albumId, userId } },
    });

    if (!shared) {
      return { isOwner: false, role: null };
    }

    return { isOwner: false, role: shared.role };
  }

  private async ensureAlbumAccess(albumId: string, userId: string, requiredRoles?: string[]) {
    const access = await this.checkAlbumAccess(albumId, userId);

    if (!access.isOwner && !access.role) {
      throw new ForbiddenException('You do not have access to this album');
    }

    if (requiredRoles && !access.isOwner && !requiredRoles.includes(access.role!)) {
      throw new ForbiddenException('Insufficient permissions');
    }
  }

  private mapAlbum(album: any) {
    return {
      id: album.id,
      name: album.name,
      description: album.description,
      coverPhotoId: album.coverPhotoId,
      photoCount: album._count?.members ?? 0,
      createdAt: album.createdAt,
      updatedAt: album.updatedAt,
    };
  }
}
