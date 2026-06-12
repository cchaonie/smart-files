import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ThumbnailService } from './thumbnail.service';

@Processor('photo-thumbnail', {
  concurrency: 2,
})
export class PhotoThumbnailWorker extends WorkerHost {
  private readonly logger = new Logger(PhotoThumbnailWorker.name);

  constructor(
    private thumbnailService: ThumbnailService,
    private prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<{ photoId: string }>): Promise<void> {
    const { photoId } = job.data;
    this.logger.log(`Processing thumbnail for photo: ${photoId}`);

    await this.thumbnailService.generate(photoId);
  }

  /**
   * On catastrophic failure (after BullMQ retries are exhausted),
   * mark the photo as FAILED and clean up partial files.
   */
  @OnWorkerEvent('failed')
  async onFailed(job: Job<{ photoId: string }>, error: Error): Promise<void> {
    const { photoId } = job.data;
    this.logger.error(
      `Thumbnail generation failed for photo ${photoId}: ${error.message}`,
    );

    try {
      const photo = await this.prisma.photo.findUnique({
        where: { id: photoId },
      });

      if (photo) {
        await this.thumbnailService.cleanup(photoId, photo.storageKey);

        await this.prisma.photo.update({
          where: { id: photoId },
          data: { status: 'FAILED' },
        });
      }
    } catch (err) {
      this.logger.error(
        `Error during failure cleanup for photo ${photoId}: ${err.message}`,
      );
    }
  }
}
