import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { PhotosService } from './photos.service';

describe('PhotosService', () => {
  let service: PhotosService;
  let prisma: jest.Mocked<PrismaService>;

  const mockPrisma = {
    photo: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockQueue = {
    add: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PhotosService,
        {
          provide: ConfigService,
          useValue: new ConfigService({ PHOTO_ROOT: '/mnt/pool' }),
        },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: getQueueToken('photo-thumbnail'), useValue: mockQueue },
        { provide: getQueueToken('ai-tagging'), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<PhotosService>(PhotosService);
    prisma = module.get(PrismaService);
  });

  describe('computeHash', () => {
    it('should return a SHA-256 hex string', () => {
      const buffer = Buffer.from('hello');
      const hash = service.computeHash(buffer);
      expect(hash).toBe(
        '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
      );
    });

    it('should return consistent hashes for identical content', () => {
      const a = service.computeHash(Buffer.from('test data'));
      const b = service.computeHash(Buffer.from('test data'));
      expect(a).toBe(b);
    });

    it('should return different hashes for different content', () => {
      const a = service.computeHash(Buffer.from('data a'));
      const b = service.computeHash(Buffer.from('data b'));
      expect(a).not.toBe(b);
    });
  });

  describe('buildStoragePath', () => {
    it('should build path with username, date, and extension', () => {
      const date = new Date('2026-06-15T12:00:00Z');
      const { relativePath, absolutePath, dir } = service.buildStoragePath(
        'chris',
        date,
        'jpg',
      );

      expect(relativePath).toMatch(/^chris\/2026\/06\/[a-f0-9-]+\.jpg$/);
      expect(absolutePath).toMatch(
        /^\/mnt\/pool\/chris\/2026\/06\/[a-f0-9-]+\.jpg$/,
      );
      expect(dir).toBe('/mnt/pool/chris/2026/06');
    });

    it('should pad month to two digits', () => {
      const date = new Date('2026-01-05T12:00:00Z');
      const { relativePath } = service.buildStoragePath('alice', date, 'png');
      expect(relativePath).toMatch(/^alice\/2026\/01\//);
    });
  });

  describe('upload', () => {
    it('should return existing photo on hash match (dedup)', async () => {
      mockPrisma.photo.findFirst.mockResolvedValue({
        id: 'existing-id',
        status: 'READY',
      });

      const result = await service.upload(
        'user-1',
        'chris',
        'photo.jpg',
        'image/jpeg',
        Buffer.from('duplicate content'),
      );

      expect(result).toEqual({ id: 'existing-id', status: 'READY' });
      expect(mockPrisma.photo.create).not.toHaveBeenCalled();
    });

    it('should create a new photo and enqueue jobs', async () => {
      mockPrisma.photo.findFirst.mockResolvedValue(null);
      mockPrisma.photo.create.mockResolvedValue({
        id: 'new-id',
        status: 'PROCESSING',
      });

      const result = await service.upload(
        'user-1',
        'chris',
        'photo.jpg',
        'image/jpeg',
        Buffer.from('new content'),
      );

      expect(result).toEqual({ id: 'new-id', status: 'PROCESSING' });
      expect(mockPrisma.photo.create).toHaveBeenCalledTimes(1);
      expect(mockQueue.add).toHaveBeenCalledTimes(2);
      expect(mockQueue.add).toHaveBeenCalledWith('process', {
        photoId: 'new-id',
      });
    });
  });
});
