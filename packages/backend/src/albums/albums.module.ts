import { Module } from '@nestjs/common';
import { AlbumsController } from './albums.controller';
import { AlbumsService } from './albums.service';
import { FamilyTimelineController } from './family-timeline.controller';
import { FamilyTimelineService } from './family-timeline.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AlbumsController, FamilyTimelineController],
  providers: [AlbumsService, FamilyTimelineService],
})
export class AlbumsModule {}
