import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { FoldersService } from './folders.service';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { CurrentUser, UserEntity } from '../common/decorators/current-user.decorator';

@ApiTags('Folders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('folders')
export class FoldersController {
  constructor(private readonly foldersService: FoldersService) {}

  @Get('browse')
  @ApiOperation({ summary: 'Browse folders and files' })
  async browse(
    @CurrentUser() user: UserEntity,
    @Query('parentId') parentId?: string,
  ) {
    return this.foldersService.browse(user.id, parentId);
  }

  @Post()
  @ApiOperation({ summary: 'Create new folder' })
  async createFolder(
    @CurrentUser() user: UserEntity,
    @Body() body: { name: string; parentId?: string },
  ) {
    return this.foldersService.createFolder(user.id, body.name, body.parentId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename folder' })
  async renameFolder(
    @CurrentUser() user: UserEntity,
    @Param('id') id: string,
    @Body() body: { name: string },
  ) {
    return this.foldersService.renameFolder(user.id, id, body.name);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete folder (must be empty)' })
  async deleteFolder(
    @CurrentUser() user: UserEntity,
    @Param('id') id: string,
  ) {
    return this.foldersService.deleteFolder(user.id, id);
  }
}
