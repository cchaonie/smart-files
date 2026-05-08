import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSessionDto {
  @ApiProperty({ example: 'document.pdf' })
  @IsString()
  fileName: string;

  @ApiProperty({ example: '10485760' })
  @IsString()
  totalSize: string;

  @ApiPropertyOptional({ example: 5242880 })
  @IsOptional()
  chunkSize?: number;

  @ApiPropertyOptional({ example: 'folder-id' })
  @IsOptional()
  folderId?: string;
}
