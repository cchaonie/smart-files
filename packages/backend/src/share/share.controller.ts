import { Controller, Get, Post, Delete, Param, Body, UseGuards, Req, Res, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Response, Request } from 'express';
import { createReadStream } from 'fs';
import * as path from 'path';
import { stat } from 'fs/promises';
import { ShareService } from './share.service';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { CurrentUser, UserEntity } from '../common/decorators/current-user.decorator';

@ApiTags('Shares')
@Controller()
export class ShareController {
  constructor(private readonly shareService: ShareService) {}

  // ── Authenticated endpoints ──

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('shares')
  @ApiOperation({ summary: 'Create a share link for a file' })
  async createShare(
    @CurrentUser() user: UserEntity,
    @Body() body: { fileId: string; password?: string; expiresInHours?: number },
  ) {
    return this.shareService.createShare(user.id, body.fileId, {
      password: body.password,
      expiresInHours: body.expiresInHours,
    });
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('shares')
  @ApiOperation({ summary: 'List all my shares' })
  async listShares(@CurrentUser() user: UserEntity) {
    return this.shareService.listShares(user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete('shares/:id')
  @ApiOperation({ summary: 'Revoke a share' })
  async deleteShare(
    @CurrentUser() user: UserEntity,
    @Param('id') id: string,
  ) {
    return this.shareService.deleteShare(user.id, id);
  }

  // ── Public endpoints (no auth) ──

  @Get('share/:token')
  @ApiOperation({ summary: 'Get share page info (public)' })
  async getShareInfo(@Param('token') token: string) {
    return this.shareService.getShareInfo(token);
  }

  @Post('share/:token/verify')
  @ApiOperation({ summary: 'Verify share access (public)' })
  async verifyShare(
    @Param('token') token: string,
    @Body() body: { password?: string },
  ) {
    // verifyShare throws if password is wrong — if it returns, access is granted
    await this.shareService.verifyShare(token, body.password);
    return { valid: true };
  }

  @Get('share/:token/download')
  @ApiOperation({ summary: 'Download shared file (public, supports Range)' })
  async downloadShare(
    @Param('token') token: string,
    @Query('password') password: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const info = await this.shareService.downloadShare(token, password);

    const uploadRoot = process.env.UPLOAD_ROOT || './data/storage';
    const filePath = path.join(uploadRoot, 'files', info.userId, info.storageKey);

    try {
      await stat(filePath);
    } catch {
      res.status(404).json({ message: 'File content not found' });
      return;
    }

    const range = req.headers.range;
    if (info.mimeType) res.setHeader('Content-Type', info.mimeType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(info.fileName)}"`,
    );

    if (range && info.size) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : info.size - 1;
      const chunkSize = end - start + 1;

      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${info.size}`);
      res.setHeader('Content-Length', chunkSize);
      createReadStream(filePath, { start, end }).pipe(res);
    } else {
      if (info.size) res.setHeader('Content-Length', info.size);
      createReadStream(filePath).pipe(res);
    }
  }
}
