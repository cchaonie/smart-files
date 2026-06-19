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
    this.logger.log(`Processing AI tagging for photo: ${photoId}`);

    // 1. Find the photo record
    const photo = await this.prisma.photo.findUnique({
      where: { id: photoId },
    });

    if (!photo) {
      throw new Error(`Photo not found: ${photoId}`);
    }

    // 2. Verify thumbnail exists (ai-tagging runs after thumbnail is generated)
    if (!photo.thumbnailPath) {
      throw new Error(`Photo ${photoId} has no thumbnail — processing blocked`);
    }

    // 3. Resolve the full path to the thumbnail
    const thumbnailPath = path.join(this.photoRoot, photo.thumbnailPath);

    // Verify file exists
    try {
      await fs.access(thumbnailPath);
    } catch {
      throw new Error(`Thumbnail file not found on disk: ${thumbnailPath}`);
    }

    // 4. Run classification
    const tags = await this.aiTaggingService.classify(thumbnailPath);

    // 5. Save tags (idempotent — skipDuplicates handles re-processing)
    if (tags.length > 0) {
      await this.aiTaggingService.saveTags(photoId, tags);
      this.logger.log(
        `Photo ${photoId}: classified with tags [${tags.map(t => `${t.tag}(${t.confidence})`).join(', ')}]`,
      );
    } else {
      this.logger.log(`Photo ${photoId}: no tags above threshold (0.3)`);
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
    } catch (err) {
      this.logger.error(
        `Error during tagging failure compensation for photo ${photoId}: ${err.message}`,
      );
    }
  }
}
