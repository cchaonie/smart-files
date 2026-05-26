import { Controller, Get, Delete, Param, UseGuards, Query, Res, Req, Patch, Body, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Response, Request } from 'express';
import { FilesService } from './files.service';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { CurrentUser, UserEntity } from '../common/decorators/current-user.decorator';
import { createReadStream } from 'fs';

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

  @Get('search')
  @ApiOperation({ summary: 'Search files by name' })
  async searchFiles(
    @CurrentUser() user: UserEntity,
    @Query('q') query: string,
  ) {
    if (!query || query.trim().length === 0) {
      return { results: [] };
    }
    return this.filesService.searchFiles(user.id, query.trim());
  }

  @Get('trash')
  @ApiOperation({ summary: 'List files in trash' })
  async listTrash(@CurrentUser() user: UserEntity) {
    return this.filesService.listTrashFiles(user.id);
  }

  @Delete('trash/empty')
  @ApiOperation({ summary: 'Permanently delete all files in trash' })
  async emptyTrash(@CurrentUser() user: UserEntity) {
    return this.filesService.emptyTrash(user.id);
  }

  @Post('batch/delete')
  @ApiOperation({ summary: 'Soft-delete multiple files' })
  async batchDelete(@CurrentUser() user: UserEntity, @Body() body: { ids: string[] }) {
    return this.filesService.batchDelete(user.id, body.ids);
  }

  @Post('batch/move')
  @ApiOperation({ summary: 'Move multiple files' })
  async batchMove(@CurrentUser() user: UserEntity, @Body() body: { ids: string[], folderId?: string | null }) {
    return this.filesService.batchMove(user.id, body.ids, body.folderId ?? null);
  }

  @Post('batch/restore')
  @ApiOperation({ summary: 'Restore multiple files from trash' })
  async batchRestore(@CurrentUser() user: UserEntity, @Body() body: { ids: string[] }) {
    return this.filesService.batchRestore(user.id, body.ids);
  }

  @Delete('batch/permanent')
  @ApiOperation({ summary: 'Permanently delete multiple files' })
  async batchPurge(@CurrentUser() user: UserEntity, @Body() body: { ids: string[] }) {
    return this.filesService.batchPurge(user.id, body.ids);
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
  @ApiOperation({ summary: 'Preview file (images, video, audio)' })
  async previewFile(
    @CurrentUser() user: UserEntity,
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const { mimeType, size, path: filePath } = await this.filesService.previewFile(user.id, id);

    const range = req.headers.range;
    if (mimeType) res.setHeader('Content-Type', mimeType);
    res.setHeader('Accept-Ranges', 'bytes');

    if (range && size) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : size - 1;
      const chunkSize = end - start + 1;

      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
      res.setHeader('Content-Length', chunkSize);
      createReadStream(filePath, { start, end }).pipe(res);
    } else {
      if (size) res.setHeader('Content-Length', size);
      const { stream } = await this.filesService.previewFile(user.id, id);
      stream.pipe(res);
    }
  }

  @Post(':id/restore')
  @ApiOperation({ summary: 'Restore a file from trash' })
  async restoreFile(
    @CurrentUser() user: UserEntity,
    @Param('id') id: string,
  ) {
    return this.filesService.restoreFile(user.id, id);
  }

  @Delete(':id/permanent')
  @ApiOperation({ summary: 'Permanently delete a file from trash' })
  async purgeFile(
    @CurrentUser() user: UserEntity,
    @Param('id') id: string,
  ) {
    return this.filesService.purgeFile(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename or move a file' })
  async updateFile(
    @CurrentUser() user: UserEntity,
    @Param('id') id: string,
    @Body() body: { name?: string; folderId?: string },
  ) {
    if (body.name !== undefined) {
      return this.filesService.renameFile(user.id, id, body.name);
    }
    return this.filesService.moveFile(user.id, id, body.folderId ?? null);
  }
}
