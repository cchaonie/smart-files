import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { FilesModule } from './files/files.module';
import { UploadModule } from './upload/upload.module';
import { FoldersModule } from './folders/folders.module';
import { ShareModule } from './share/share.module';
import { UsersModule } from './users/users.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    FilesModule,
    UploadModule,
    FoldersModule,
    ShareModule,
    UsersModule,
    AdminModule,
  ],
})
export class AppModule {}
