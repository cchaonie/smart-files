import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { FilesModule } from './files/files.module';
import { UploadModule } from './upload/upload.module';
import { FoldersModule } from './folders/folders.module';
import { ShareModule } from './share/share.module';
import { RedisModule } from './redis/redis.module';
import { RedisService } from './redis/redis.service';
import { PhotosModule } from './photos/photos.module';
import { AlbumsModule } from './albums/albums.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    RedisModule,
    BullModule.forRootAsync({
      useFactory: (redisService: RedisService) => ({
        connection: redisService.getClient() as any,
      }),
      inject: [RedisService],
    }),
    PrismaModule,
    AuthModule,
    FilesModule,
    UploadModule,
    FoldersModule,
    ShareModule,
    PhotosModule,
    AlbumsModule,
    UsersModule,
  ],
})
export class AppModule {}
