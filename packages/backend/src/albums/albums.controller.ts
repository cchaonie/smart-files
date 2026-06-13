import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AlbumsService } from './albums.service';

@Controller('albums')
@UseGuards(JwtAuthGuard)
export class AlbumsController {
  constructor(private albumsService: AlbumsService) {}

  @Post()
  async create(
    @Body() body: { name: string; description?: string },
    @CurrentUser() user: { id: string },
  ) {
    return this.albumsService.create(user.id, body.name, body.description);
  }

  @Get()
  async list(@CurrentUser() user: { id: string }) {
    return this.albumsService.list(user.id);
  }

  @Get(':id')
  async findById(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.albumsService.findById(id, user.id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string },
    @CurrentUser() user: { id: string },
  ) {
    return this.albumsService.update(id, user.id, body);
  }

  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    await this.albumsService.delete(id, user.id);
    return { message: 'Album deleted' };
  }

  // --- Sharing ---

  @Post(':id/share')
  async share(
    @Param('id') id: string,
    @Body() body: { userId: string; role: string },
    @CurrentUser() user: { id: string },
  ) {
    return this.albumsService.share(id, user.id, body.userId, body.role);
  }

  @Delete(':id/share/:userId')
  async unshare(
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
    @CurrentUser() user: { id: string },
  ) {
    await this.albumsService.unshare(id, user.id, targetUserId);
    return { message: 'Share removed' };
  }

  @Get(':id/shares')
  async listShares(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.albumsService.listShares(id, user.id);
  }

  // --- Album photos ---

  @Post(':id/photos')
  async addPhoto(
    @Param('id') id: string,
    @Body() body: { photoId: string },
    @CurrentUser() user: { id: string },
  ) {
    return this.albumsService.addPhoto(id, user.id, body.photoId);
  }

  @Delete(':id/photos/:photoId')
  async removePhoto(
    @Param('id') id: string,
    @Param('photoId') photoId: string,
    @CurrentUser() user: { id: string },
  ) {
    await this.albumsService.removePhoto(id, user.id, photoId);
    return { message: 'Photo removed from album' };
  }

  @Get(':id/photos')
  async listAlbumPhotos(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.albumsService.listAlbumPhotos(id, user.id);
  }
}
