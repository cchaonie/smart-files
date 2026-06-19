import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ThumbnailService } from './thumbnail.service';
import { PhotoSagaService } from './photo-saga.service';

@Processor('photo-thumbnail', {
  concurrency: 2,
})
export class PhotoThumbnailWorker extends WorkerHost {
  private readonly logger = new Logger(PhotoThumbnailWorker.name);

  constructor(
    private thumbnailService: ThumbnailService,
    private prisma: PrismaService,
    private sagaService: PhotoSagaService,
  ) {
    super();
  }

  async process(job: Job<{ photoId: string }>): Promise<void> {
    const { photoId } = job.data;

    const lockValue = await this.sagaService.acquireLock(photoId);
    if (!lockValue) {
      throw new Error(`Could not acquire distributed lock for photo ${photoId}`);
    }

    const refreshTimer = this.sagaService.startLockRefresh(photoId, lockValue);

    try {
      await this.sagaService.transition(
        photoId,
        ['UPLOADED', 'PROCESSING', 'THUMBNAIL_FAILED'],
        'THUMBNAILING',
        this.prisma,
      );

      this.logger.log(`Processing thumbnail for photo: ${photoId}`);
      await this.thumbnailService.generate(photoId);

      await this.prisma.photo.update({
        where: { id: photoId },
        data: { retryCount: 0 },
      });
    } finally {
      this.sagaService.stopLockRefresh(refreshTimer);
      await this.sagaService.releaseLock(photoId, lockValue).catch(() => {});
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<{ photoId: string }>, error: Error): Promise<void> {
    const { photoId } = job.data;
    this.logger.error(
      `Thumbnail generation failed for photo ${photoId} after retries: ${error.message}`,
    );

    try {
      const photo = await this.prisma.photo.findUnique({
        where: { id: photoId },
        select: { id: true, status: true },
      });

      if (!photo) return;

      if (photo.status === 'THUMBNAILING') {
        await this.sagaService.transition(
          photoId,
          ['THUMBNAILING'],
          'THUMBNAIL_FAILED',
          this.prisma,
        );

        this.logger.log(
          `Photo ${photoId} marked as THUMBNAIL_FAILED — original file kept intact`,
        );
      }
    } catch (err) {
      this.logger.error(
        `Error during failure compensation for photo ${photoId}: ${err.message}`,
      );
    }
  }
}
