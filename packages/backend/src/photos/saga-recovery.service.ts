import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';

const RECOVERABLE_STATUSES = ['THUMBNAILING', 'TAGGING'];
const LEGACY_STATUSES = ['PROCESSING'];

@Injectable()
export class SagaRecoveryService implements OnModuleInit {
  private readonly logger = new Logger(SagaRecoveryService.name);

  constructor(
    private prisma: PrismaService,
    @InjectQueue('photo-thumbnail') private thumbnailQueue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    const allStatuses = [...RECOVERABLE_STATUSES, ...LEGACY_STATUSES] as any;

    const photos = await this.prisma.photo.findMany({
      where: { status: { in: allStatuses } },
      select: { id: true, status: true },
    });

    if (photos.length === 0) {
      this.logger.log('No photos found in recoverable states — skipping crash recovery');
      return;
    }

    const recoverable = photos.filter((p) => RECOVERABLE_STATUSES.includes(p.status));
    const legacy = photos.filter((p) => LEGACY_STATUSES.includes(p.status));

    if (recoverable.length > 0) {
      this.logger.log(
        `Crash recovery: resetting ${recoverable.length} photos in recoverable states (${recoverable.map((p) => p.status).join(', ')}) to UPLOADED`,
      );
    }

    if (legacy.length > 0) {
      this.logger.log(
        `Legacy migration: resetting ${legacy.length} photos from PROCESSING to UPLOADED`,
      );
    }

    await this.prisma.photo.updateMany({
      where: { status: { in: allStatuses as any } },
      data: { status: 'UPLOADED' as any },
    });

    let reQueued = 0;
    for (const photo of photos) {
      await this.thumbnailQueue.add('process', { photoId: photo.id });
      reQueued++;
    }

    this.logger.log(`Re-enqueued ${reQueued} thumbnail jobs for recovered photos`);
  }
}
