import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
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
