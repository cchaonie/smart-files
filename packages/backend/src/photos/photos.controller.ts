import {
  Body,
  Controller,
  Post,
  Get,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  BadRequestException,
  StreamableFile,
  Header,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PhotosService } from './photos.service';

interface UploadedFile {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

@Controller('photos')
@UseGuards(JwtAuthGuard)
export class PhotosController {
  constructor(private photosService: PhotosService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: UploadedFile,
    @Body('captureDate') captureDate: string | undefined,
    @CurrentUser() user: { id: string; name: string },
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    return this.photosService.upload(
      user.id,
      user.name || 'unknown',
      file.originalname,
      file.mimetype,
      file.buffer,
      captureDate,
    );
  }

  @Post(':id/retry')
  async retry(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; name: string },
  ) {
    return this.photosService.retry(id, user.id);
  }

  @Get('tags')
  async getTags(
    @Query('q') q: string | undefined,
    @CurrentUser() user: { id: string; name: string },
  ) {
    return this.photosService.getTags(user.id, q);
  }

  @Get()
  async list(
    @Query('cursor') cursor: string | undefined,
    @Query('limit') limit: string | undefined,
    @Query('tag') tag: string | undefined,
    @CurrentUser() user: { id: string; name: string },
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    if (parsedLimit !== undefined && (isNaN(parsedLimit) || parsedLimit < 1)) {
      throw new BadRequestException('limit must be a positive integer');
    }
    return this.photosService.list(user.id, cursor, parsedLimit, tag);
  }

  @Get(':id')
  async findById(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; name: string },
  ) {
    return this.photosService.findById(id, user.id);
  }

  @Get(':id/thumbnail')
  @Header('Content-Type', 'image/webp')
  async thumbnail(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; name: string },
  ) {
    const { stream } = await this.photosService.getThumbnailStream(id, user.id);
    return new StreamableFile(stream);
  }

  @Get(':id/preview')
  @Header('Content-Type', 'image/jpeg')
  async preview(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; name: string },
  ) {
    const { stream } = await this.photosService.getPreviewStream(id, user.id);
    return new StreamableFile(stream);
  }
}
