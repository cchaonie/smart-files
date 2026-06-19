import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { StorageMetricsService } from './storage-metrics.service';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { constants } from 'node:fs';
import { PhotoStatus } from '@prisma/client';

const BATCH_SIZE = 500;
const WARM_PERIOD_MS = 5 * 60 * 1000;
const STALE_PROCESSING_MS = 60 * 60 * 1000;
const ORPHAN_FILE_AGE_MS = 60 * 60 * 1000;
const CYCLE_INTERVAL_MS = 60 * 60 * 1000;
const LARGE_FILE_BYTES = 1_073_741_824;

@Processor('orphan-reconciler', { concurrency: 1 })
export class OrphanReconcilerService extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(OrphanReconcilerService.name);
  private readonly photoRoot: string;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    @InjectQueue('orphan-reconciler') private queue: Queue,
    private redisService: RedisService,
    private metrics: StorageMetricsService,
  ) {
    super();
    this.photoRoot =
      this.configService.get<string>('PHOTO_ROOT') || '/mnt/pool';
  }

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(
      'orphan-reconciliation',
      { every: CYCLE_INTERVAL_MS },
      { name: 'reconcile', data: {} },
    );
    this.logger.log('Orphan reconciliation scheduler registered (every 60 min)');
  }

  async process(_job: Job): Promise<void> {
    const redis = this.redisService.getClient();
    const skipKey = 'orphan:reconciler:skip_next';

    const shouldSkip = await redis.get(skipKey);
    if (shouldSkip === '1') {
      this.logger.warn(
        'Previous cycle exceeded 60 min — skipping this cycle',
      );
      await redis.del(skipKey);
      return;
    }

    const cycleStart = Date.now();

    let totalScanned = 0;
    let totalOrphans = 0;
    let totalQuarantined = 0;

    try {
      const dbResult = await this.reconcileDbRecordsWithoutFiles();
      totalScanned += dbResult.scanned;
      totalOrphans += dbResult.orphans;

      const staleResult = await this.reconcileStaleProcessingMarkers();
      totalScanned += staleResult.scanned;
      totalOrphans += staleResult.orphans;

      const orphanFileResult = await this.reconcileOrphanFiles();
      totalScanned += orphanFileResult.scanned;
      totalOrphans += orphanFileResult.orphans;
      totalQuarantined += orphanFileResult.quarantined;

      await this.cleanupOrphanedPhotoTags();
    } catch (error) {
      this.logger.error(
        `Orphan reconciliation cycle failed: ${error.message}`,
        error.stack,
      );
    }

    const elapsed = Date.now() - cycleStart;

    this.logger.log(
      `storage.orphans.cycle_summary scanned=${totalScanned} orphans=${totalOrphans} quarantined=${totalQuarantined} duration=${elapsed}ms`,
    );

    this.metrics.recordCycle({
      duration: elapsed,
      scanned: totalScanned,
      orphans: totalOrphans,
      quarantined: totalQuarantined,
    });

    if (elapsed > CYCLE_INTERVAL_MS) {
      await redis.set(skipKey, '1', 'PX', CYCLE_INTERVAL_MS);
      this.logger.warn(
        `Cycle took ${elapsed}ms — next cycle will be skipped`,
      );
    }
  }

  async reconcileDbRecordsWithoutFiles(): Promise<{ scanned: number; orphans: number }> {
    const statusesToCheck: PhotoStatus[] = [
      'UPLOADED', 'PROCESSING', 'THUMBNAILING',
      'THUMBNAIL_FAILED', 'TAGGING', 'READY',
    ];

    const warmPeriodCutoff = new Date(Date.now() - WARM_PERIOD_MS);
    let cursor: { id: string; createdAt: Date } | undefined;
    let scanned = 0;
    let orphans = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const photos = await this.prisma.photo.findMany({
        where: {
          status: { in: statusesToCheck },
          updatedAt: { lt: warmPeriodCutoff },
          ...(cursor ? {
            OR: [
              { createdAt: { lt: cursor.createdAt } },
              { createdAt: cursor.createdAt, id: { lt: cursor.id } },
            ],
          } : {}),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: BATCH_SIZE,
        select: { id: true, storageKey: true, status: true, createdAt: true },
      });

      if (photos.length === 0) break;
      scanned += photos.length;

      for (const photo of photos) {
        const absolutePath = path.join(this.photoRoot, photo.storageKey);
        try {
          await fs.access(absolutePath, constants.F_OK);
        } catch (err: any) {
          if (err.code === 'ENOENT') {
            await this.prisma.photo.update({
              where: { id: photo.id },
              data: {
                status: 'ORPHANED',
                orphanedAt: new Date(),
                orphanReason: 'file_not_found_on_disk',
              },
            });
            this.metrics.incrementCounter('storage.orphans.total');
            this.logger.warn(
              `storage.orphans.detected reason=file_not_found_on_disk photoId=${photo.id} path=${photo.storageKey}`,
            );
            orphans++;
          } else {
            this.logger.warn(
              `Cannot check file for photo ${photo.id}: ${err.message}`,
            );
          }
        }
      }

      cursor = { id: photos[photos.length - 1].id, createdAt: photos[photos.length - 1].createdAt };
    }

    if (orphans > 0) {
      this.logger.log(
        `Marked ${orphans} DB records as ORPHANED (file missing from disk)`,
      );
    }

    return { scanned, orphans };
  }

  async reconcileStaleProcessingMarkers(): Promise<{ scanned: number; orphans: number }> {
    const warmPeriodCutoff = new Date(Date.now() - WARM_PERIOD_MS);
    let cursor: { id: string; createdAt: Date } | undefined;
    let scanned = 0;
    let orphans = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const photos = await this.prisma.photo.findMany({
        where: {
          status: { in: ['UPLOADED', 'PROCESSING'] },
          updatedAt: { lt: warmPeriodCutoff },
          ...(cursor ? {
            OR: [
              { createdAt: { lt: cursor.createdAt } },
              { createdAt: cursor.createdAt, id: { lt: cursor.id } },
            ],
          } : {}),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: BATCH_SIZE,
        select: { id: true, storageKey: true, createdAt: true },
      });

      if (photos.length === 0) break;
      scanned += photos.length;

      for (const photo of photos) {
        const markerPath = path.join(
          this.photoRoot,
          `${photo.storageKey}.processing`,
        );
        try {
          const stat = await fs.stat(markerPath);
          const age = Date.now() - stat.mtimeMs;
          if (age >= STALE_PROCESSING_MS) {
            await this.prisma.photo.update({
              where: { id: photo.id },
              data: {
                status: 'ORPHANED',
                orphanedAt: new Date(),
                orphanReason: 'stale_processing_marker',
              },
            });
            this.metrics.incrementCounter('storage.orphans.total');
            this.logger.warn(
              `storage.orphans.detected reason=stale_processing_marker photoId=${photo.id} path=${photo.storageKey}`,
            );
            orphans++;
          }
        } catch (err: any) {
          if (err.code !== 'ENOENT') {
            this.logger.warn(
              `Cannot stat marker for photo ${photo.id}: ${err.message}`,
            );
          }
        }
      }

      cursor = { id: photos[photos.length - 1].id, createdAt: photos[photos.length - 1].createdAt };
    }

    if (orphans > 0) {
      this.logger.log(
        `Marked ${orphans} photos as ORPHANED (stale .processing markers)`,
      );
    }

    return { scanned, orphans };
  }

  async reconcileOrphanFiles(): Promise<{ scanned: number; orphans: number; quarantined: number }> {
    const knownKeys = new Set<string>();
    let cursor: { id: string; createdAt: Date } | undefined;
    let scanned = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const photos = await this.prisma.photo.findMany({
        where: cursor ? {
          OR: [
            { createdAt: { lt: cursor.createdAt } },
            { createdAt: cursor.createdAt, id: { lt: cursor.id } },
          ],
        } : {},
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: BATCH_SIZE,
        select: { id: true, storageKey: true, createdAt: true },
      });

      if (photos.length === 0) break;
      scanned += photos.length;
      for (const p of photos) {
        knownKeys.add(p.storageKey);
      }
      cursor = { id: photos[photos.length - 1].id, createdAt: photos[photos.length - 1].createdAt };
    }

    const orphanFiles: Array<{
      absolutePath: string;
      relativePath: string;
    }> = [];
    const largeSkipped: Array<{
      absolutePath: string;
      size: number;
    }> = [];

    const topEntries = await fs.readdir(this.photoRoot, {
      withFileTypes: true,
    });

    for (const entry of topEntries) {
      if (entry.name.startsWith('.')) continue;
      const dirPath = path.join(this.photoRoot, entry.name);
      await this.walkForOrphansIterative(
        entry.name,
        dirPath,
        knownKeys,
        orphanFiles,
        largeSkipped,
      );
    }

    for (const file of largeSkipped) {
      this.metrics.incrementCounter('storage.orphans.skipped_large');
      this.logger.warn(
        `storage.orphans.skipped_large path=${file.absolutePath} size=${file.size}`,
      );
    }

    if (largeSkipped.length > 0) {
      this.logger.warn(
        `storage.orphans.skipped_large: ${largeSkipped.length} files >1GB skipped`,
      );
    }

    let quarantined = 0;
    for (const file of orphanFiles) {
      try {
        const fstat = await fs.stat(file.absolutePath);
        const age = Date.now() - fstat.mtimeMs;
        if (age < ORPHAN_FILE_AGE_MS) continue;
      } catch {
        continue;
      }

      const quarantinePath = path.join(
        this.photoRoot,
        '.orphans',
        file.relativePath,
      );
      const quarantineDir = path.dirname(quarantinePath);
      await fs.mkdir(quarantineDir, { recursive: true });
      try {
        await fs.rename(file.absolutePath, quarantinePath);
      } catch (renameErr: any) {
        if (renameErr.code === 'EXDEV') {
          const data = await fs.readFile(file.absolutePath);
          await fs.writeFile(quarantinePath, data);
          await fs.unlink(file.absolutePath);
        } else {
          this.logger.error(
            `Failed to quarantine ${file.relativePath}: ${renameErr.message}`,
          );
          continue;
        }
      }
      this.metrics.incrementCounter('storage.orphans.total');
      this.logger.warn(
        `storage.orphans.detected reason=orphan_file_on_disk path=${file.relativePath}`,
      );
      quarantined++;
    }

    if (quarantined > 0) {
      this.logger.log(`Moved ${quarantined} orphan files to .orphans/ quarantine`);
    }

    return { scanned, orphans: quarantined, quarantined };
  }

  private async walkForOrphansIterative(
    topRelativeDir: string,
    topAbsoluteDir: string,
    knownKeys: Set<string>,
    orphanFiles: Array<{ absolutePath: string; relativePath: string }>,
    largeSkipped: Array<{ absolutePath: string; size: number }>,
  ): Promise<void> {
    const stack: Array<{ relativeDir: string; absoluteDir: string }> = [
      { relativeDir: topRelativeDir, absoluteDir: topAbsoluteDir },
    ];

    while (stack.length > 0) {
      const { relativeDir, absoluteDir } = stack.pop()!;

      let entries;
      try {
        entries = await fs.readdir(absoluteDir, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;

        const fullPath = path.join(absoluteDir, entry.name);
        const relativePath = path.posix.join(relativeDir, entry.name);

        if (entry.isDirectory()) {
          stack.push({ relativeDir: relativePath, absoluteDir: fullPath });
        } else if (entry.isFile() || entry.isSymbolicLink()) {
          if (entry.name.endsWith('.processing')) continue;

          if (knownKeys.has(relativePath)) continue;

          try {
            const fstat = await fs.stat(fullPath);
            if (fstat.size > LARGE_FILE_BYTES) {
              largeSkipped.push({
                absolutePath: fullPath,
                size: fstat.size,
              });
              continue;
            }
            orphanFiles.push({
              absolutePath: fullPath,
              relativePath,
            });
          } catch {
            // Skip files we can't stat
          }
        }
      }
    }
  }

  async cleanupOrphanedPhotoTags(): Promise<void> {
    let deletedTags = 0;
    let cursor: string | undefined;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const orphanedPhotos = await this.prisma.photo.findMany({
        where: {
          status: 'ORPHANED',
          ...(cursor ? { id: { lt: cursor } } : {}),
        },
        orderBy: { id: 'desc' },
        take: BATCH_SIZE,
        select: { id: true },
      });

      if (orphanedPhotos.length === 0) break;

      const ids = orphanedPhotos.map((p) => p.id);
      const result = await this.prisma.$transaction([
        this.prisma.photoTag.deleteMany({
          where: { photoId: { in: ids } },
        }),
      ]);
      deletedTags += result[0].count;
      cursor = orphanedPhotos[orphanedPhotos.length - 1].id;
    }

    if (deletedTags > 0) {
      this.logger.log(
        `Deleted ${deletedTags} PhotoTag rows for ORPHANED photos`,
      );
    }

    let emptyCursor: string | undefined;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const emptyTags = await this.prisma.photoTag.findMany({
        where: {
          tag: '',
          photo: { status: 'COMPLETED' },
          ...(emptyCursor ? { id: { lt: emptyCursor } } : {}),
        },
        orderBy: { id: 'desc' },
        take: BATCH_SIZE,
      });

      if (emptyTags.length === 0) break;

      const ids = emptyTags.map((t) => t.id);
      const result = await this.prisma.photoTag.deleteMany({
        where: { id: { in: ids } },
      });
      deletedTags += result.count;
      emptyCursor = emptyTags[emptyTags.length - 1].id;
    }

    if (deletedTags > 0) {
      this.logger.log(
        `Deleted ${deletedTags} empty PhotoTag rows referencing COMPLETED photos`,
      );
    }
  }
}
