import {
  Controller,
  Post,
  Param,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  BadRequestException,
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
    );
  }

  @Post(':id/retry')
  async retry(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; name: string },
  ) {
    return this.photosService.retry(id, user.id);
  }
}
