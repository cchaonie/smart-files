import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PhotosController } from './photos.controller';
import { PhotosService } from './photos.service';
import { ThumbnailService } from './thumbnail.service';
import { PhotoThumbnailWorker } from './photo-thumbnail.worker';
import { PhotoSagaService } from './photo-saga.service';
import { SagaRecoveryService } from './saga-recovery.service';
import { OrphanReconcilerService } from './orphan-reconciler.service';
import { PhotoRetryService } from './photo-retry.service';
import { StorageMetricsService } from './storage-metrics.service';
import { StorageHealthController } from './storage-health.controller';
import { AiTaggingModule } from '../ai-tagging/ai-tagging.module';
import { AiTaggingWorker } from '../ai-tagging/ai-tagging.worker';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'photo-thumbnail' },
      { name: 'ai-tagging' },
      { name: 'orphan-reconciler' },
      { name: 'photo-thumbnail-retry' },
    ),
    AiTaggingModule,
  ],
  controllers: [PhotosController, StorageHealthController],
  providers: [
    PhotosService,
    ThumbnailService,
    PhotoThumbnailWorker,
    PhotoSagaService,
    SagaRecoveryService,
    AiTaggingWorker,
    OrphanReconcilerService,
    PhotoRetryService,
    StorageMetricsService,
  ],
})
export class PhotosModule {}
