import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PhotosController } from './photos.controller';
import { PhotosService } from './photos.service';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'photo-thumbnail' },
      { name: 'ai-tagging' },
    ),
  ],
  controllers: [PhotosController],
  providers: [PhotosService],
})
export class PhotosModule {}
