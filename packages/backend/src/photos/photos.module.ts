import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PhotosController } from './photos.controller';
import { PhotosService } from './photos.service';
import { ThumbnailService } from './thumbnail.service';
import { PhotoThumbnailWorker } from './photo-thumbnail.worker';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'photo-thumbnail' },
      { name: 'ai-tagging' },
    ),
  ],
  controllers: [PhotosController],
  providers: [PhotosService, ThumbnailService, PhotoThumbnailWorker],
})
export class PhotosModule {}
