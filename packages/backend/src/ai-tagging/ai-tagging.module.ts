import { Module } from '@nestjs/common';
import { AiTaggingService } from './ai-tagging.service';

@Module({
  providers: [AiTaggingService],
  exports: [AiTaggingService],
})
export class AiTaggingModule {}
