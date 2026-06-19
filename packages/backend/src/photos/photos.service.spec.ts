import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { PhotosService } from './photos.service';

jest.mock('node:fs/promises');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fsMock = require('node:fs/promises');

describe('PhotosService', () => {
  let service: PhotosService;

  const mockPrisma = {
    photo: {
      findFirst: jest.fn(),
      create: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    file: {
      create: jest.fn(),
    },
    folder: {
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
    beforeEach(() => {
      fsMock.writeFile.mockResolvedValue(undefined);
      fsMock.unlink.mockResolvedValue(undefined);
      fsMock.mkdir.mockResolvedValue(undefined);
    });

    it('should return existing photo on P2002 unique constraint violation (dedup)', async () => {
      mockPrisma.photo.create.mockRejectedValue({ code: 'P2002' });
      mockPrisma.photo.findFirst.mockResolvedValue({
        id: 'existing-id',
        status: 'COMPLETED',
      });

      const result = await service.upload(
        'user-1',
        'chris',
        'photo.jpg',
        'image/jpeg',
        Buffer.from('duplicate content'),
      );

      expect(result).toEqual({ id: 'existing-id', status: 'COMPLETED' });
      expect(mockPrisma.photo.create).toHaveBeenCalledTimes(1);
    });

    it('should create a new photo, write file, and enqueue thumbnail job', async () => {
      mockPrisma.photo.create.mockResolvedValue({
        id: 'new-id',
        userId: 'user-1',
        status: 'UPLOADED',
      });
      mockPrisma.file.create.mockResolvedValue({});
      mockQueue.add.mockResolvedValue(undefined);

      const result = await service.upload(
        'user-1',
        'chris',
        'photo.jpg',
        'image/jpeg',
        Buffer.from('new content'),
      );

      expect(result).toEqual({ id: 'new-id', status: 'UPLOADED' });
      expect(mockPrisma.photo.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.file.create).toHaveBeenCalledTimes(1);
      expect(mockQueue.add).toHaveBeenCalledTimes(1);
      expect(mockQueue.add).toHaveBeenCalledWith('process', {
        photoId: 'new-id',
      });
    });

    it('should rollback DB record and clean up files on write failure', async () => {
      mockPrisma.photo.create.mockResolvedValue({
        id: 'new-id',
        status: 'UPLOADED',
      });

      fsMock.writeFile.mockRejectedValue(new Error('Disk full'));

      await expect(
        service.upload(
          'user-1',
          'chris',
          'photo.jpg',
          'image/jpeg',
          Buffer.from('failing content'),
        ),
      ).rejects.toThrow('Disk full');

      expect(mockPrisma.photo.delete).toHaveBeenCalledWith({
        where: { id: 'new-id' },
      });
    });

    it('should not create File record or enqueue jobs when dedup returns existing', async () => {
      mockPrisma.photo.create.mockRejectedValue({ code: 'P2002' });
      mockPrisma.photo.findFirst.mockResolvedValue({
        id: 'existing-id',
        status: 'COMPLETED',
      });

      await service.upload(
        'user-1',
        'chris',
        'photo.jpg',
        'image/jpeg',
        Buffer.from('duplicate'),
      );

      expect(mockPrisma.file.create).not.toHaveBeenCalled();
      expect(mockQueue.add).not.toHaveBeenCalled();
    });
  });

  describe('retry', () => {
    it('should throw NotFoundException if photo does not exist', async () => {
      mockPrisma.photo.findUnique.mockResolvedValue(null);

      await expect(service.retry('non-existent-id', 'user-1')).rejects.toThrow(
        'Photo not found',
      );
    });

    it('should throw ConflictException if photo is not FAILED', async () => {
      mockPrisma.photo.findUnique.mockResolvedValue({
        id: 'photo-1',
        userId: 'user-1',
        status: 'PROCESSING',
      });

      await expect(service.retry('photo-1', 'user-1')).rejects.toThrow(
        'Photo is not in FAILED status',
      );
    });

    it('should throw NotFoundException if photo belongs to another user', async () => {
      mockPrisma.photo.findUnique.mockResolvedValue({
        id: 'photo-1',
        userId: 'other-user',
        status: 'FAILED',
      });

      await expect(service.retry('photo-1', 'user-1')).rejects.toThrow(
        'Photo not found',
      );
    });

    it('should reset status to UPLOADED and re-enqueue thumbnail job for FAILED photo', async () => {
      mockPrisma.photo.findUnique.mockResolvedValue({
        id: 'photo-1',
        userId: 'user-1',
        status: 'FAILED',
      });
      mockPrisma.photo.update.mockResolvedValue({
        id: 'photo-1',
        status: 'UPLOADED',
      });
      mockQueue.add.mockResolvedValue(undefined);

      const result = await service.retry('photo-1', 'user-1');

      expect(result).toEqual({ id: 'photo-1', status: 'UPLOADED' });
      expect(mockPrisma.photo.update).toHaveBeenCalledWith({
        where: { id: 'photo-1' },
        data: { status: 'UPLOADED' },
      });
      expect(mockQueue.add).toHaveBeenCalledWith('process', {
        photoId: 'photo-1',
      });
    });
  });
});
