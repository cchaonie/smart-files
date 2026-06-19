import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PhotoSagaService } from './photo-saga.service';

const BATCH_SIZE = 500;
const MAX_RETRIES = 24;
const CYCLE_INTERVAL_MS = 60 * 60 * 1000;

@Processor('photo-thumbnail-retry', { concurrency: 1 })
export class PhotoRetryService extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(PhotoRetryService.name);

  constructor(
    private prisma: PrismaService,
    private sagaService: PhotoSagaService,
    @InjectQueue('photo-thumbnail-retry') private retryQueue: Queue,
    @InjectQueue('photo-thumbnail') private thumbnailQueue: Queue,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.retryQueue.upsertJobScheduler(
      'photo-thumbnail-retry-scheduler',
      { every: CYCLE_INTERVAL_MS },
      { name: 'retry', data: {} },
    );
    this.logger.log('Photo thumbnail retry scheduler registered (every 60 min)');
  }

  async process(_job: Job): Promise<void> {
    const photos = await this.prisma.photo.findMany({
      where: { status: 'THUMBNAIL_FAILED' },
      orderBy: { updatedAt: 'asc' },
      take: BATCH_SIZE,
      select: { id: true, retryCount: true },
    });

    if (photos.length === 0) {
      this.logger.log('No THUMBNAIL_FAILED photos to retry');
      return;
    }

    this.logger.log(`Processing ${photos.length} THUMBNAIL_FAILED photos for retry`);

    for (const photo of photos) {
      const lockValue = await this.sagaService.acquireLock(photo.id);
      if (!lockValue) {
        this.logger.debug(
          `Skipping photo ${photo.id} — lock held by another process`,
        );
        continue;
      }

      try {
        if (photo.retryCount >= MAX_RETRIES) {
          await this.prisma.photo.update({
            where: { id: photo.id },
            data: { status: 'THUMBNAIL_PERMANENTLY_FAILED' },
          });
          this.logger.warn(
            `Photo ${photo.id} exceeded max retries (${MAX_RETRIES}) — marked as THUMBNAIL_PERMANENTLY_FAILED`,
          );
        } else {
          await this.prisma.photo.update({
            where: { id: photo.id },
            data: { retryCount: { increment: 1 } },
          });
          await this.thumbnailQueue.add('thumbnail', { photoId: photo.id });
          this.logger.log(
            `Re-queued photo ${photo.id} for thumbnail generation (retry ${photo.retryCount + 1}/${MAX_RETRIES})`,
          );
        }
      } finally {
        await this.sagaService.releaseLock(photo.id, lockValue).catch(() => {});
      }
    }
  }
}
