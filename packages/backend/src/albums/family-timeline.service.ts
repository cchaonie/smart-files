import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FamilyTimelineService {
  constructor(private prisma: PrismaService) {}

  async list(userId: string, cursor?: string, limit?: number) {
    const take = Math.min(limit ?? 20, 100);

    // Get all album IDs the user can access
    const ownedAlbums = await this.prisma.album.findMany({
      where: { ownerId: userId },
      select: { id: true },
    });
    const sharedEntries = await this.prisma.sharedAlbum.findMany({
      where: { userId },
      select: { albumId: true },
    });
    const accessibleAlbumIds = [
      ...ownedAlbums.map((a) => a.id),
      ...sharedEntries.map((s) => s.albumId),
    ];

    if (accessibleAlbumIds.length === 0) {
      return { photos: [], nextCursor: null, total: 0 };
    }

    // Get all photo IDs from these albums
    const memberRecords = await this.prisma.albumPhotoMember.findMany({
      where: { albumId: { in: accessibleAlbumIds } },
      select: { photoId: true, photo: { select: { hash: true } } },
    });

    // Dedup by hash
    const seenHashes = new Set<string>();
    const uniquePhotoIds: string[] = [];
    for (const m of memberRecords) {
      if (!seenHashes.has(m.photo.hash)) {
        seenHashes.add(m.photo.hash);
        uniquePhotoIds.push(m.photoId);
      }
    }

    if (uniquePhotoIds.length === 0) {
      return { photos: [], nextCursor: null, total: 0 };
    }

    // Now paginate over unique photo IDs ordered by capturedAt DESC
    // Build cursor filter
    const where: any = { id: { in: uniquePhotoIds } };
    if (cursor) {
      const cursorRecord = await this.prisma.photo.findUnique({
        where: { id: cursor },
      });
      if (!cursorRecord) {
        throw new NotFoundException('Invalid cursor');
      }
      where.OR = [
        { capturedAt: { lt: cursorRecord.capturedAt } },
        { capturedAt: cursorRecord.capturedAt, id: { lt: cursorRecord.id } },
        { capturedAt: null, createdAt: { lt: cursorRecord.createdAt } },
      ];
      where.id = { in: uniquePhotoIds }; // keep album filter
    }

    const photos = await this.prisma.photo.findMany({
      where,
      orderBy: [
        { capturedAt: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      take: take + 1,
      include: { tags: true },
    });

    const hasMore = photos.length > take;
    const items = hasMore ? photos.slice(0, take) : photos;
    const total = uniquePhotoIds.length;

    const mapped = items.map((photo) => ({
      id: photo.id,
      originalName: photo.originalName,
      mimeType: photo.mimeType,
      fileSize: photo.size,
      width: photo.width,
      height: photo.height,
      thumbnailPath: `/api/photos/${photo.id}/thumbnail`,
      previewPath: `/api/photos/${photo.id}/preview`,
      capturedAt: photo.capturedAt,
      status: photo.status,
      tags: photo.tags.map((t) => ({ tag: t.tag, confidence: t.confidence })),
    }));

    return {
      photos: mapped,
      nextCursor: hasMore ? items[items.length - 1].id : null,
      total,
    };
  }
}
