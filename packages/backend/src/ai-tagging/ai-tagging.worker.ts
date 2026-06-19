import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AiTaggingService } from './ai-tagging.service';
import { PhotoSagaService } from '../photos/photo-saga.service';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';

@Processor('ai-tagging', {
  concurrency: 2,
})
export class AiTaggingWorker extends WorkerHost {
  private readonly logger = new Logger(AiTaggingWorker.name);
  private readonly photoRoot: string;

  constructor(
    private aiTaggingService: AiTaggingService,
    private prisma: PrismaService,
    private configService: ConfigService,
    private sagaService: PhotoSagaService,
  ) {
    super();
    this.photoRoot =
      this.configService.get<string>('PHOTO_ROOT') || '/mnt/pool';
  }

  async process(job: Job<{ photoId: string }>): Promise<void> {
    const { photoId } = job.data;

    const lockValue = await this.sagaService.acquireLock(photoId);
    if (!lockValue) {
      throw new Error(`Could not acquire distributed lock for photo ${photoId}`);
    }

    const refreshTimer = this.sagaService.startLockRefresh(photoId, lockValue);

    try {
      this.logger.log(`Processing AI tagging for photo: ${photoId}`);

      const photo = await this.prisma.photo.findUnique({
        where: { id: photoId },
      });

      if (!photo) {
        throw new Error(`Photo not found: ${photoId}`);
      }

      if (!photo.thumbnailPath) {
        throw new Error(`Photo ${photoId} has no thumbnail — processing blocked`);
      }

      const thumbnailPath = path.join(this.photoRoot, photo.thumbnailPath);

      try {
        await fs.access(thumbnailPath);
      } catch {
        throw new Error(`Thumbnail file not found on disk: ${thumbnailPath}`);
      }

      const tags = await this.aiTaggingService.classify(thumbnailPath);

      if (tags.length > 0) {
        await this.aiTaggingService.saveTags(photoId, tags);
        this.logger.log(
          `Photo ${photoId}: classified with tags [${tags.map(t => `${t.tag}(${t.confidence})`).join(', ')}]`,
        );
      } else {
        this.logger.log(`Photo ${photoId}: no tags above threshold (0.3)`);
      }

      await this.sagaService.transition(
        photoId,
        ['TAGGING'],
        'COMPLETED',
        this.prisma,
      );
    } finally {
      this.sagaService.stopLockRefresh(refreshTimer);
      await this.sagaService.releaseLock(photoId, lockValue).catch(() => {});
    }
  }

  /**
   * On failure after all retries, compensate:
   * - Delete any partial PhotoTag records in a transaction
   * - Keep thumbnails (independently useful)
   * - Mark photo as COMPLETED (tagging is a nice-to-have)
   */
  @OnWorkerEvent('failed')
  async onFailed(job: Job<{ photoId: string }>, error: Error): Promise<void> {
    const { photoId } = job.data;
    this.logger.error(
      `AI tagging failed for photo ${photoId} after retries: ${error.message}`,
    );

    try {
      const lockValue = await this.sagaService.acquireLock(photoId);
      if (!lockValue) return;

      try {
        const photo = await this.prisma.photo.findUnique({
          where: { id: photoId },
          select: { id: true, status: true },
        });

        if (!photo) return;

        if (photo.status === 'TAGGING') {
          await this.prisma.$transaction(async (tx) => {
            await tx.photoTag.deleteMany({ where: { photoId } });
            await this.sagaService.transition(
              photoId,
              ['TAGGING'],
              'COMPLETED',
              tx,
            );
          });

          this.logger.log(
            `Photo ${photoId} tagging failed — deleted partial tags, marked as COMPLETED`,
          );
        }
      } finally {
        await this.sagaService.releaseLock(photoId, lockValue).catch(() => {});
      }
    } catch (err) {
      this.logger.error(
        `Error during tagging failure compensation for photo ${photoId}: ${err.message}`,
      );
    }
  }
}
