import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PhotosController } from './photos.controller';
import { PhotosService } from './photos.service';
import { ThumbnailService } from './thumbnail.service';
import { PhotoThumbnailWorker } from './photo-thumbnail.worker';
import { AiTaggingModule } from '../ai-tagging/ai-tagging.module';
import { AiTaggingWorker } from '../ai-tagging/ai-tagging.worker';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'photo-thumbnail' },
      { name: 'ai-tagging' },
    ),
    AiTaggingModule,
  ],
  controllers: [PhotosController],
  providers: [PhotosService, ThumbnailService, PhotoThumbnailWorker, AiTaggingWorker],
})
export class PhotosModule {}
