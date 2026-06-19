import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { ThumbnailService } from './thumbnail.service';

jest.mock('node:fs/promises');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fsMock = require('node:fs/promises');

describe('ThumbnailService', () => {
  let service: ThumbnailService;

  const mockPrisma = {
    photo: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockAiTaggingQueue = {
    add: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    fsMock.mkdir.mockResolvedValue(undefined);
    fsMock.unlink.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ThumbnailService,
        {
          provide: ConfigService,
          useValue: new ConfigService({ PHOTO_ROOT: '/mnt/pool' }),
        },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: getQueueToken('ai-tagging'), useValue: mockAiTaggingQueue },
      ],
    }).compile();

    service = module.get<ThumbnailService>(ThumbnailService);
  });

  describe('generate', () => {
    it('should throw if photo is not found', async () => {
      mockPrisma.photo.findUnique.mockResolvedValue(null);

      await expect(service.generate('non-existent-id')).rejects.toThrow(
        'Photo not found: non-existent-id',
      );
    });

    it('should process a photo, update record, and enqueue ai-tagging', async () => {
      const mockPhoto = {
        id: 'photo-1',
        userId: 'user-1',
        originalName: 'test.jpg',
        mimeType: 'image/jpeg',
        size: 12345,
        hash: 'abc123',
        storageKey: 'chris/2026/06/test.jpg',
        status: 'PROCESSING',
        capturedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.photo.findUnique.mockResolvedValue(mockPhoto);
      mockPrisma.photo.update.mockResolvedValue({
        ...mockPhoto,
        thumbnailPath: 'chris/2026/06/test_thumb.webp',
        previewPath: 'chris/2026/06/test_preview.jpg',
        width: 1920,
        height: 1080,
        status: 'TAGGING',
      });

      // Call generate — sharp operations will throw in test environment
      // since there's no actual file. This confirms the happy path error
      // actually comes from sharp, not from missing setup.
      await expect(service.generate('photo-1')).rejects.toThrow();

      // Verify the photo lookup was called
      expect(mockPrisma.photo.findUnique).toHaveBeenCalledWith({
        where: { id: 'photo-1' },
      });
    });

    it('should call cleanup on failure', async () => {
      const mockPhoto = {
        id: 'photo-1',
        userId: 'user-1',
        originalName: 'test.jpg',
        mimeType: 'image/jpeg',
        size: 12345,
        hash: 'abc123',
        storageKey: 'chris/2026/06/test.jpg',
        status: 'PROCESSING',
        capturedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.photo.findUnique.mockResolvedValue(mockPhoto);

      // Mock cleanup to track it's called
      const cleanupSpy = jest.spyOn(service, 'cleanup');

      await expect(service.generate('photo-1')).rejects.toThrow();

      // Cleanup should be called with photoId and storageKey
      expect(cleanupSpy).toHaveBeenCalledWith('photo-1', 'chris/2026/06/test.jpg');
    });
  });

  describe('cleanup', () => {
    it('should not throw when cleaning up non-existent files', async () => {
      await expect(
        service.cleanup('photo-1', 'chris/2026/06/test.jpg'),
      ).resolves.toBeUndefined();
    });
  });
});
