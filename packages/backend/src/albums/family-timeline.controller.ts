import { Controller, Get, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { FamilyTimelineService } from './family-timeline.service';

@Controller('family-timeline')
@UseGuards(JwtAuthGuard)
export class FamilyTimelineController {
  constructor(private familyTimelineService: FamilyTimelineService) {}

  @Get()
  async list(
    @Query('cursor') cursor: string | undefined,
    @Query('limit') limit: string | undefined,
    @CurrentUser() user: { id: string },
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    if (parsedLimit !== undefined && (isNaN(parsedLimit) || parsedLimit < 1)) {
      throw new BadRequestException('limit must be a positive integer');
    }
    return this.familyTimelineService.list(user.id, cursor, parsedLimit);
  }
}
