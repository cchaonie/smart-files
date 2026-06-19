import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';

// Use require for sharp — works at runtime on production NAS with libvips
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sharp = require('sharp');

@Injectable()
export class ThumbnailService {
  private readonly logger = new Logger(ThumbnailService.name);
  private readonly photoRoot: string;
  private readonly thumbRoot: string;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    @InjectQueue('ai-tagging') private aiTaggingQueue: Queue,
  ) {
    this.photoRoot =
      this.configService.get<string>('PHOTO_ROOT') || '/mnt/pool';
    this.thumbRoot = path.join(this.photoRoot, '.thumbnails');
  }

  /**
   * Generate thumbnail and preview for a photo.
   *
   * Thumbnails are stored under {PHOTO_ROOT}/.thumbnails/{user}/{YYYY}/{MM}/:
   *   - {id}_grid.webp    → 320px WebP square crop for grid display
   *   - {id}_preview.jpg   → 1200px JPEG (maintains aspect ratio) for preview
   *
   * On success, updates the Photo record and enqueues the ai-tagging job.
   * On failure, cleans up any partial files and re-throws.
   */
  async generate(photoId: string): Promise<void> {
    const photo = await this.prisma.photo.findUnique({
      where: { id: photoId },
    });

    if (!photo) {
      throw new Error(`Photo not found: ${photoId}`);
    }

    const sourcePath = path.join(this.photoRoot, photo.storageKey);
    const thumbDir = path.join(
      this.thumbRoot,
      path.dirname(photo.storageKey),
    );

    await fs.mkdir(thumbDir, { recursive: true });

    const gridPath = path.join(thumbDir, `${photoId}_grid.webp`);
    const previewPath = path.join(thumbDir, `${photoId}_preview.jpg`);

    try {
      // Get metadata for dimensions
      const metadata = await sharp(sourcePath).metadata();
      const width = metadata.width || 0;
      const height = metadata.height || 0;

      // 320px WebP grid thumbnail (square cover crop for consistent grid)
      await sharp(sourcePath)
        .resize(320, 320, { fit: 'cover', position: 'centre', withoutEnlargement: true })
        .webp({ quality: 80, effort: 4 })
        .toFile(gridPath);

      // 1200px JPEG preview (maintain aspect ratio, no upscale)
      await sharp(sourcePath)
        .resize(1200, undefined, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85, mozjpeg: true, progressive: true })
        .toFile(previewPath);

      // Store relative paths from photoRoot
      const relativeGridPath = path.relative(this.photoRoot, gridPath);
      const relativePreviewPath = path.relative(this.photoRoot, previewPath);

      // Update Photo record
      await this.prisma.photo.update({
        where: { id: photoId },
        data: {
          thumbnailPath: relativeGridPath,
          previewPath: relativePreviewPath,
          width,
          height,
          status: 'TAGGING',
        },
      });

      // Enqueue ai-tagging job now that thumbnails are ready
      await this.aiTaggingQueue.add('process', { photoId });

      this.logger.log(
        `Thumbnails generated for photo ${photoId} (${width}x${height})`,
      );
    } catch (error) {
      // Clean up partial files on failure
      await this.cleanup(photoId, photo.storageKey);
      this.logger.error(
        `Thumbnail generation failed for photo ${photoId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Remove partial thumbnail/preview files on failure.
   */
  async cleanup(photoId: string, storageKey: string): Promise<void> {
    try {
      const thumbDir = path.join(
        this.thumbRoot,
        path.dirname(storageKey),
      );
      const gridPath = path.join(thumbDir, `${photoId}_grid.webp`);
      const previewPath = path.join(thumbDir, `${photoId}_preview.jpg`);

      await Promise.allSettled([
        fs.unlink(gridPath).catch(() => {}),
        fs.unlink(previewPath).catch(() => {}),
      ]);
    } catch {
      // Ignore cleanup errors
    }
  }
}
