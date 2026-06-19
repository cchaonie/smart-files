import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { StorageMetricsService } from './storage-metrics.service';
import { OrphanReconcilerService } from './orphan-reconciler.service';

jest.mock('node:fs/promises');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fsMock = require('node:fs/promises');

describe('OrphanReconcilerService', () => {
  let service: OrphanReconcilerService;
  let prisma: any;
  let queueMock: any;

  const mockPhoto = (overrides = {}) => ({
    id: 'photo-1',
    userId: 'user-1',
    originalName: 'test.jpg',
    mimeType: 'image/jpeg',
    size: 12345,
    hash: 'abc123',
    storageKey: 'chris/2026/06/uuid.jpg',
    status: 'UPLOADED',
    capturedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(Date.now() - 10 * 60 * 1000),
    ...overrides,
  });

  const defaultPrismaMock = () => ({
    photo: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    photoTag: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn((queries: any[]) =>
      queries.map(() => ({ count: 0 })),
    ),
  });

  const defaultQueueMock = () => ({
    upsertJobScheduler: jest.fn(),
    add: jest.fn(),
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma = defaultPrismaMock();
    queueMock = defaultQueueMock();

    // Default mocks — prevent crashes during process() chain
    fsMock.readdir.mockResolvedValue([]);
    fsMock.stat.mockResolvedValue({ isFile: () => true, mtimeMs: Date.now(), size: 1000 });
    fsMock.access.mockResolvedValue(undefined);
    fsMock.mkdir.mockResolvedValue(undefined);
    fsMock.rename.mockResolvedValue(undefined);
    fsMock.unlink.mockResolvedValue(undefined);
    prisma.photoTag.findMany.mockResolvedValue([]);
    prisma.photo.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrphanReconcilerService,
        StorageMetricsService,
        {
          provide: ConfigService,
          useValue: new ConfigService({ PHOTO_ROOT: '/mnt/pool' }),
        },
        { provide: PrismaService, useValue: prisma },
        { provide: getQueueToken('orphan-reconciler'), useValue: queueMock },
      ],
    }).compile();

    service = module.get<OrphanReconcilerService>(OrphanReconcilerService);
  });

  describe('onModuleInit', () => {
    it('should register the repeatable job scheduler', async () => {
      await service.onModuleInit();

      expect(queueMock.upsertJobScheduler).toHaveBeenCalledWith(
        'orphan-reconciliation',
        { every: 3600000 },
        { name: 'reconcile', data: {} },
      );
    });
  });

  describe('process', () => {
    it('should skip cycle if previous one exceeded 60 min', async () => {
      const mockJob = { data: {} } as Job;
      (service as any).lastCycleTooLong = true;

      const warnSpy = jest.spyOn(service['logger'], 'warn').mockImplementation();

      await service.process(mockJob);

      expect(warnSpy).toHaveBeenCalledWith(
        'Previous cycle exceeded 60 min — skipping this cycle',
      );
    });

    it('should handle empty database gracefully', async () => {
      await expect(service.process({ data: {} } as Job)).resolves.toBeUndefined();
    });

    it('should catch and log errors without crashing', async () => {
      prisma.photo.findMany.mockRejectedValue(new Error('DB connection lost'));

      const errorSpy = jest
        .spyOn(service['logger'], 'error')
        .mockImplementation();

      await expect(service.process({ data: {} } as Job)).resolves.toBeUndefined();
      expect(errorSpy).toHaveBeenCalled();
    });

    it('should reset lastCycleTooLong after skipping', async () => {
      const mockJob = { data: {} } as Job;
      (service as any).lastCycleTooLong = true;

      const warnSpy = jest.spyOn(service['logger'], 'warn').mockImplementation();
      await service.process(mockJob);

      expect(warnSpy).toHaveBeenCalled();
      // After skipping, the flag should be reset
      expect((service as any).lastCycleTooLong).toBe(false);
    });
  });

  describe('reconcileDbRecordsWithoutFiles', () => {
    it('should mark photos as ORPHANED when file is missing', async () => {
      const photo = mockPhoto({ storageKey: 'chris/2026/06/missing.jpg' });
      prisma.photo.findMany
        .mockResolvedValueOnce([photo])
        .mockResolvedValueOnce([]);
      fsMock.access.mockRejectedValue(new Error('ENOENT'));

      await service.reconcileDbRecordsWithoutFiles();

      expect(prisma.photo.update).toHaveBeenCalledWith({
        where: { id: 'photo-1' },
        data: {
          status: 'ORPHANED',
          orphanedAt: expect.any(Date),
          orphanReason: 'file_not_found_on_disk',
        },
      });
    });

    it('should not mark photos when file exists', async () => {
      const photo = mockPhoto({ storageKey: 'chris/2026/06/exists.jpg' });
      prisma.photo.findMany
        .mockResolvedValueOnce([photo])
        .mockResolvedValueOnce([]);
      fsMock.access.mockResolvedValue(undefined);

      await service.reconcileDbRecordsWithoutFiles();

      expect(prisma.photo.update).not.toHaveBeenCalled();
    });

    it('should only check photos older than warm period', async () => {
      const recentPhoto = mockPhoto({
        updatedAt: new Date(), // too recent
      });
      const oldPhoto = mockPhoto({
        id: 'photo-2',
        updatedAt: new Date(Date.now() - 10 * 60 * 1000), // old enough
      });

      prisma.photo.findMany
        .mockResolvedValueOnce([recentPhoto, oldPhoto])
        .mockResolvedValueOnce([]);

      fsMock.access.mockRejectedValue(new Error('ENOENT'));

      // Both photos have updatedAt > and < warm period
      // The warm period check is done by prisma in the WHERE clause (updatedAt: { lt: warmPeriodCutoff })
      // So the mock returns one photo that's within warm period and one that's not
      // But since our mock returns them both in the same batch, access will be called for both
      // The WHERE clause in the real code would filter the recent one out
      // For the test, we verify that the `updatedAt: { lt: ... }` filter is applied

      await service.reconcileDbRecordsWithoutFiles();

      // Check the where clause passed to prisma
      const callArgs = prisma.photo.findMany.mock.calls[0][0];
      expect(callArgs.where.updatedAt).toBeDefined();
      expect(callArgs.where.updatedAt.lt).toBeInstanceOf(Date);
    });

    it('should paginate through photos in batches', async () => {
      const batch1 = Array.from({ length: 500 }, (_, i) =>
        mockPhoto({
          id: `photo-${i}`,
          storageKey: `chris/2026/06/uuid-${i}.jpg`,
        }),
      );
      const batch2 = Array.from({ length: 100 }, (_, i) =>
        mockPhoto({
          id: `photo-${500 + i}`,
          storageKey: `chris/2026/06/uuid-${500 + i}.jpg`,
        }),
      );

      prisma.photo.findMany
        .mockResolvedValueOnce(batch1)
        .mockResolvedValueOnce(batch2)
        .mockResolvedValueOnce([]);

      fsMock.access.mockRejectedValue(new Error('ENOENT'));

      await service.reconcileDbRecordsWithoutFiles();

      expect(prisma.photo.findMany).toHaveBeenCalledTimes(3);
      // First call: no cursor
      expect(prisma.photo.findMany.mock.calls[0][0].where.id).toBeUndefined();
      // Second call: has cursor from batch1
      expect(prisma.photo.findMany.mock.calls[1][0].where.id).toBeDefined();
    });
  });

  describe('reconcileStaleProcessingMarkers', () => {
    it('should mark photos as ORPHANED when .processing marker is stale', async () => {
      const photo = mockPhoto({ status: 'UPLOADED' });
      prisma.photo.findMany
        .mockResolvedValueOnce([photo])
        .mockResolvedValueOnce([]);
      fsMock.stat.mockResolvedValue({
        isFile: () => true,
        mtimeMs: Date.now() - 2 * 60 * 60 * 1000, // 2 hours old
      });

      await service.reconcileStaleProcessingMarkers();

      expect(prisma.photo.update).toHaveBeenCalledWith({
        where: { id: 'photo-1' },
        data: {
          status: 'ORPHANED',
          orphanedAt: expect.any(Date),
          orphanReason: 'stale_processing_marker',
        },
      });
    });

    it('should not mark when .processing marker file is recent', async () => {
      const photo = mockPhoto({ status: 'UPLOADED' });
      prisma.photo.findMany
        .mockResolvedValueOnce([photo])
        .mockResolvedValueOnce([]);
      fsMock.stat.mockResolvedValue({
        isFile: () => true,
        mtimeMs: Date.now() - 30 * 1000, // 30 seconds old — within limit
      });

      await service.reconcileStaleProcessingMarkers();

      expect(prisma.photo.update).not.toHaveBeenCalled();
    });

    it('should not mark when .processing marker does not exist', async () => {
      const photo = mockPhoto({ status: 'UPLOADED' });
      prisma.photo.findMany
        .mockResolvedValueOnce([photo])
        .mockResolvedValueOnce([]);
      fsMock.stat.mockRejectedValue(new Error('ENOENT'));

      await service.reconcileStaleProcessingMarkers();

      expect(prisma.photo.update).not.toHaveBeenCalled();
    });
  });

  describe('reconcileOrphanFiles', () => {
    beforeEach(() => {
      fsMock.readdir.mockReset();
      fsMock.stat.mockReset();
      fsMock.mkdir.mockReset();
      fsMock.rename.mockReset();

      // Default: no photos in DB
      prisma.photo.findMany.mockResolvedValue([]);
    });

    it('should move orphan files to .orphans quarantine', async () => {
      // Mock filesystem walk: one top-level dir "chris" with one orphan file
      fsMock.readdir
        .mockResolvedValueOnce([
          { name: 'chris', isDirectory: () => true, isFile: () => false, isBlockDevice: () => false, isCharacterDevice: () => false, isFIFO: () => false, isSocket: () => false, isSymbolicLink: () => false },
        ])
        .mockResolvedValueOnce([
          { name: '2026', isDirectory: () => true, isFile: () => false, isBlockDevice: () => false, isCharacterDevice: () => false, isFIFO: () => false, isSocket: () => false, isSymbolicLink: () => false },
        ])
        .mockResolvedValueOnce([
          { name: '06', isDirectory: () => true, isFile: () => false, isBlockDevice: () => false, isCharacterDevice: () => false, isFIFO: () => false, isSocket: () => false, isSymbolicLink: () => false },
        ])
        .mockResolvedValueOnce([
          { name: 'orphan.jpg', isDirectory: () => false, isFile: () => true, isBlockDevice: () => false, isCharacterDevice: () => false, isFIFO: () => false, isSocket: () => false, isSymbolicLink: () => false },
        ]);

      fsMock.stat.mockResolvedValue({ mtimeMs: Date.now() - 2 * 60 * 60 * 1000, size: 50000 });
      fsMock.mkdir.mockResolvedValue(undefined);
      fsMock.rename.mockResolvedValue(undefined);

      await service.reconcileOrphanFiles();

      expect(fsMock.rename).toHaveBeenCalledWith(
        '/mnt/pool/chris/2026/06/orphan.jpg',
        '/mnt/pool/.orphans/chris/2026/06/orphan.jpg',
      );
    });

    it('should skip orphan files newer than 1 hour', async () => {
      fsMock.readdir
        .mockResolvedValueOnce([
          { name: 'chris', isDirectory: () => true, isFile: () => false, isBlockDevice: () => false, isCharacterDevice: () => false, isFIFO: () => false, isSocket: () => false, isSymbolicLink: () => false },
        ])
        .mockResolvedValueOnce([
          { name: '2026', isDirectory: () => true, isFile: () => false, isBlockDevice: () => false, isCharacterDevice: () => false, isFIFO: () => false, isSocket: () => false, isSymbolicLink: () => false },
        ])
        .mockResolvedValueOnce([
          { name: '06', isDirectory: () => true, isFile: () => false, isBlockDevice: () => false, isCharacterDevice: () => false, isFIFO: () => false, isSocket: () => false, isSymbolicLink: () => false },
        ])
        .mockResolvedValueOnce([
          { name: 'recent.jpg', isDirectory: () => false, isFile: () => true, isBlockDevice: () => false, isCharacterDevice: () => false, isFIFO: () => false, isSocket: () => false, isSymbolicLink: () => false },
        ]);

      fsMock.stat.mockResolvedValue({ mtimeMs: Date.now() - 30 * 1000, size: 50000 }); // 30 seconds old

      await service.reconcileOrphanFiles();

      expect(fsMock.rename).not.toHaveBeenCalled();
    });

    it('should skip files > 1GB and log them', async () => {
      fsMock.readdir
        .mockResolvedValueOnce([
          { name: 'chris', isDirectory: () => true, isFile: () => false, isBlockDevice: () => false, isCharacterDevice: () => false, isFIFO: () => false, isSocket: () => false, isSymbolicLink: () => false },
        ])
        .mockResolvedValueOnce([
          { name: 'big.avi', isDirectory: () => false, isFile: () => true, isBlockDevice: () => false, isCharacterDevice: () => false, isFIFO: () => false, isSocket: () => false, isSymbolicLink: () => false },
        ]);

      fsMock.stat.mockResolvedValue({ mtimeMs: Date.now() - 2 * 60 * 60 * 1000, size: 2_000_000_000 }); // 2GB

      const warnSpy = jest.spyOn(service['logger'], 'warn').mockImplementation();

      await service.reconcileOrphanFiles();

      expect(fsMock.rename).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('storage.orphans.skipped_large'),
      );
    });

    it('should skip known photos in DB', async () => {
      // DB has a known photo
      prisma.photo.findMany
        .mockResolvedValueOnce([
          { id: 'photo-1', storageKey: 'chris/2026/06/known.jpg' },
        ])
        .mockResolvedValueOnce([]);

      fsMock.readdir
        .mockResolvedValueOnce([
          { name: 'chris', isDirectory: () => true, isFile: () => false, isBlockDevice: () => false, isCharacterDevice: () => false, isFIFO: () => false, isSocket: () => false, isSymbolicLink: () => false },
        ])
        .mockResolvedValueOnce([
          { name: '2026', isDirectory: () => true, isFile: () => false, isBlockDevice: () => false, isCharacterDevice: () => false, isFIFO: () => false, isSocket: () => false, isSymbolicLink: () => false },
        ])
        .mockResolvedValueOnce([
          { name: '06', isDirectory: () => true, isFile: () => false, isBlockDevice: () => false, isCharacterDevice: () => false, isFIFO: () => false, isSocket: () => false, isSymbolicLink: () => false },
        ])
        .mockResolvedValueOnce([
          { name: 'known.jpg', isDirectory: () => false, isFile: () => true, isBlockDevice: () => false, isCharacterDevice: () => false, isFIFO: () => false, isSocket: () => false, isSymbolicLink: () => false },
        ]);

      fsMock.stat.mockResolvedValue({ mtimeMs: Date.now() - 2 * 60 * 60 * 1000, size: 50000 });

      await service.reconcileOrphanFiles();

      // known.jpg should NOT be moved
      expect(fsMock.rename).not.toHaveBeenCalled();
    });

    it('should skip hidden directories and .processing files', async () => {
      fsMock.readdir
        .mockResolvedValueOnce([
          { name: '.thumbnails', isDirectory: () => true, isFile: () => false, isBlockDevice: () => false, isCharacterDevice: () => false, isFIFO: () => false, isSocket: () => false, isSymbolicLink: () => false },
          { name: '.orphans', isDirectory: () => true, isFile: () => false, isBlockDevice: () => false, isCharacterDevice: () => false, isFIFO: () => false, isSocket: () => false, isSymbolicLink: () => false },
          { name: 'chris', isDirectory: () => true, isFile: () => false, isBlockDevice: () => false, isCharacterDevice: () => false, isFIFO: () => false, isSocket: () => false, isSymbolicLink: () => false },
        ])
        .mockResolvedValueOnce([
          { name: 'photo.jpg', isDirectory: () => false, isFile: () => true, isBlockDevice: () => false, isCharacterDevice: () => false, isFIFO: () => false, isSocket: () => false, isSymbolicLink: () => false },
          { name: 'photo.jpg.processing', isDirectory: () => false, isFile: () => true, isBlockDevice: () => false, isCharacterDevice: () => false, isFIFO: () => false, isSocket: () => false, isSymbolicLink: () => false },
        ]);

      fsMock.stat.mockResolvedValue({ mtimeMs: Date.now() - 2 * 60 * 60 * 1000, size: 50000 });
      fsMock.mkdir.mockResolvedValue(undefined);
      fsMock.rename.mockResolvedValue(undefined);

      await service.reconcileOrphanFiles();

      // .processing files should NOT be moved
      expect(fsMock.rename).toHaveBeenCalledTimes(1);
      expect(fsMock.rename).toHaveBeenCalledWith(
        expect.stringContaining('photo.jpg'),
        expect.stringContaining('.orphans'),
      );
    });
  });

  describe('cleanupOrphanedPhotoTags', () => {
    it('should delete PhotoTag rows for ORPHANED photos', async () => {
      prisma.photo.findMany
        .mockResolvedValueOnce([
          { id: 'orphaned-photo-1' },
        ])
        .mockResolvedValueOnce([]);
      prisma.$transaction.mockResolvedValue([{ count: 3 }]);
      prisma.photoTag.findMany.mockResolvedValue([]);
      prisma.photoTag.deleteMany.mockResolvedValue({ count: 0 });

      await service.cleanupOrphanedPhotoTags();

      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should delete empty PhotoTag rows for COMPLETED photos', async () => {
      prisma.photo.findMany.mockResolvedValue([]);
      prisma.photoTag.findMany.mockResolvedValue([
        { id: 'empty-tag-1', photoId: 'photo-1', tag: '', confidence: null },
        { id: 'empty-tag-2', photoId: 'photo-2', tag: '', confidence: 0.5 },
      ]);
      prisma.photoTag.deleteMany.mockResolvedValue({ count: 2 });

      await service.cleanupOrphanedPhotoTags();

      expect(prisma.photoTag.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['empty-tag-1', 'empty-tag-2'] } },
      });
    });
  });
});
