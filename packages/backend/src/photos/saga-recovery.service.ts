import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'node:fs/promises';
import { execSync } from 'node:child_process';

const CRASHED_STATUSES = ['THUMBNAILING', 'TAGGING'];
const LEGACY_STATUSES = ['PROCESSING', 'READY'];

@Injectable()
export class SagaRecoveryService implements OnModuleInit {
  private readonly logger = new Logger(SagaRecoveryService.name);

  constructor(
    private prisma: PrismaService,
    @InjectQueue('photo-thumbnail') private thumbnailQueue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    const allStatuses = [...CRASHED_STATUSES, ...LEGACY_STATUSES] as any;

    const photos = await this.prisma.photo.findMany({
      where: { status: { in: allStatuses } },
      select: { id: true, status: true },
    });

    if (photos.length === 0) {
      this.logger.log('No photos found in recoverable states — skipping crash recovery');
      return;
    }

    const crashed = photos.filter((p) => CRASHED_STATUSES.includes(p.status));
    const legacy = photos.filter((p) => LEGACY_STATUSES.includes(p.status));

    // Crashed TAGGING photos already have thumbnails — just re-enqueue AI tagging
    const taggingWithThumbnails = crashed.filter((p) => p.status === 'TAGGING');
    const thumbnailingWithoutThumbnails = crashed.filter((p) => p.status === 'THUMBNAILING');

    if (crashed.length > 0) {
      this.logger.log(
        `Crash recovery: ${thumbnailingWithoutThumbnails.length} to reset to UPLOADED, ${taggingWithThumbnails.length} to re-enqueue AI tagging`,
      );
    }

    if (legacy.length > 0) {
      const legacyProcessing = legacy.filter((p) => p.status === 'PROCESSING');
      const legacyReady = legacy.filter((p) => p.status === 'READY');
      if (legacyProcessing.length > 0) {
        this.logger.log(`Legacy migration: resetting ${legacyProcessing.length} PROCESSING photos to UPLOADED`);
      }
      if (legacyReady.length > 0) {
        this.logger.log(`Legacy migration: transitioning ${legacyReady.length} READY photos to TAGGING`);
      }
    }

    // Reset crashed THUMBNAILING + legacy PROCESSING to UPLOADED
    const toReset = [...thumbnailingWithoutThumbnails, ...legacy.filter((p) => p.status === 'PROCESSING')];
    if (toReset.length > 0) {
      await this.prisma.photo.updateMany({
        where: { id: { in: toReset.map((p) => p.id) } },
        data: { status: 'UPLOADED' as any },
      });
    }

    // Reset legacy READY to TAGGING (they already have thumbnails)
    const toTag = [...taggingWithThumbnails, ...legacy.filter((p) => p.status === 'READY')];
    if (toTag.length > 0) {
      await this.prisma.photo.updateMany({
        where: { id: { in: toTag.map((p) => p.id) } },
        data: { status: 'TAGGING' as any },
      });
    }

    // Enqueue jobs — use allSettled to handle partial failures without stranding
    const enqueueResults = await Promise.allSettled(
      toReset.map((photo) =>
        this.thumbnailQueue.add('process', { photoId: photo.id }),
      ),
    );

    const fulfilled = enqueueResults.filter((r) => r.status === 'fulfilled').length;
    const rejected = enqueueResults.filter((r) => r.status === 'rejected').length;

    if (rejected > 0) {
      this.logger.error(
        `${rejected} thumbnail enqueues failed during crash recovery — these photos will remain in UPLOADED until retry cron picks them up`,
      );
    }

    this.logger.log(
      `Crash recovery complete: ${fulfilled} thumbnail jobs enqueued, ${toTag.length} TAGGING photos ready for AI tagging`,
    );

    // Clean up stale .processing marker files
    await this.cleanupStaleProcessingMarkers();
  }

  private async cleanupStaleProcessingMarkers(): Promise<void> {
    const photoRoot =
      process.env['PHOTO_ROOT'] || '/mnt/pool';

    try {
      const result = execSync(
        `find "${photoRoot}" -name "*.processing" -mmin +60 -type f 2>/dev/null`,
        { encoding: 'utf-8', timeout: 30000 },
      );
      const staleFiles = result.trim().split('\n').filter(Boolean);
      if (staleFiles.length === 0) return;

      let removed = 0;
      for (const file of staleFiles) {
        try {
          await fs.unlink(file);
          removed++;
        } catch {
          // file may have been removed concurrently
        }
      }
      if (removed > 0) {
        this.logger.log(`Cleaned up ${removed} stale .processing marker files`);
      }
    } catch {
      // find command may fail if directory doesn't exist yet
    }
  }
}
