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
}
