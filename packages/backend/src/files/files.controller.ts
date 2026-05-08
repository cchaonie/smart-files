import { Controller, Get, Delete, Param, UseGuards, Query, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { FilesService } from './files.service';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { CurrentUser, UserEntity } from '../common/decorators/current-user.decorator';

@ApiTags('Files')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Get()
  @ApiOperation({ summary: 'List user files' })
  async listFiles(
    @CurrentUser() user: UserEntity,
    @Query('folderId') folderId?: string,
  ) {
    return this.filesService.listFiles(user.id, folderId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a file' })
  async deleteFile(
    @CurrentUser() user: UserEntity,
    @Param('id') id: string,
  ) {
    return this.filesService.deleteFile(user.id, id);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Download file' })
  async downloadFile(
    @CurrentUser() user: UserEntity,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { stream, filename, mimeType } = await this.filesService.downloadFile(user.id, id);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    if (mimeType) res.setHeader('Content-Type', mimeType);
    stream.pipe(res);
  }

  @Get(':id/preview')
  @ApiOperation({ summary: 'Preview file (images)' })
  async previewFile(
    @CurrentUser() user: UserEntity,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { stream, mimeType } = await this.filesService.previewFile(user.id, id);
    if (mimeType) res.setHeader('Content-Type', mimeType);
    stream.pipe(res);
  }
}
