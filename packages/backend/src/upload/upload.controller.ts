import { Controller, Post, Get, Put, Body, Param, UseGuards, Query, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { Request } from 'express';
import { UploadService } from './upload.service';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { CurrentUser, UserEntity } from '../common/decorators/current-user.decorator';
import { CreateSessionDto } from './dto';

@ApiTags('Upload')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('session')
  @ApiOperation({ summary: 'Create upload session' })
  async createSession(
    @CurrentUser() user: UserEntity,
    @Body() dto: CreateSessionDto,
  ) {
    return this.uploadService.createSession(user.id, dto);
  }

  @Get('session/:id')
  @ApiOperation({ summary: 'Get upload session status' })
  async getSession(
    @CurrentUser() user: UserEntity,
    @Param('id') id: string,
  ) {
    return this.uploadService.getSession(user.id, id);
  }

  @Put('session/:id/chunk')
  @ApiOperation({ summary: 'Upload chunk' })
  @ApiConsumes('application/octet-stream')
  async uploadChunk(
    @CurrentUser() user: UserEntity,
    @Param('id') id: string,
    @Query('index') index: string,
    @Req() req: Request,
  ) {
    const chunkIndex = parseInt(index, 10);
    return this.uploadService.uploadChunk(user.id, id, chunkIndex, req);
  }

  @Post('session/:id/complete')
  @ApiOperation({ summary: 'Complete upload' })
  async completeUpload(
    @CurrentUser() user: UserEntity,
    @Param('id') id: string,
    @Body() body: { mimeType?: string },
  ) {
    return this.uploadService.completeUpload(user.id, id, body.mimeType);
  }
}
