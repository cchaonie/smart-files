import { Test, TestingModule } from '@nestjs/testing';
import { PhotoSagaService } from './photo-saga.service';
import { RedisService } from '../redis/redis.service';

describe('PhotoSagaService', () => {
  let service: PhotoSagaService;

  const mockRedisClient = {
    set: jest.fn(),
    eval: jest.fn(),
  };

  const mockRedisService = {
    getClient: jest.fn(() => mockRedisClient),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PhotoSagaService,
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    service = module.get<PhotoSagaService>(PhotoSagaService);
  });

  describe('acquireLock', () => {
    it('should acquire lock and return lock value', async () => {
      mockRedisClient.set.mockResolvedValue('OK');

      const lockValue = await service.acquireLock('photo-1');

      expect(lockValue).toBeTruthy();
      expect(typeof lockValue).toBe('string');
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'photo:lock:photo-1',
        expect.any(String),
        'PX',
        300000,
        'NX',
      );
    });

    it('should return null when lock cannot be acquired', async () => {
      mockRedisClient.set.mockResolvedValue(null);

      const lockValue = await service.acquireLock('photo-1');

      expect(lockValue).toBeNull();
    });
  });

  describe('releaseLock', () => {
    it('should release lock using Lua script', async () => {
      mockRedisClient.eval.mockResolvedValue(1);

      await service.releaseLock('photo-1', 'lock-value-123');

      expect(mockRedisClient.eval).toHaveBeenCalledWith(
        expect.stringContaining('redis.call'),
        1,
        'photo:lock:photo-1',
        'lock-value-123',
      );
    });
  });

  describe('refreshLock', () => {
    it('should refresh lock TTL and return true', async () => {
      mockRedisClient.eval.mockResolvedValue(1);

      const result = await service.refreshLock('photo-1', 'lock-value-123', 60000);

      expect(result).toBe(true);
      expect(mockRedisClient.eval).toHaveBeenCalledWith(
        expect.stringContaining('redis.call'),
        1,
        'photo:lock:photo-1',
        'lock-value-123',
        '60000',
      );
    });

    it('should return false when lock is lost', async () => {
      mockRedisClient.eval.mockResolvedValue(0);

      const result = await service.refreshLock('photo-1', 'stale-value');

      expect(result).toBe(false);
    });
  });

  describe('isValidTransition', () => {
    it('should allow UPLOADED → THUMBNAILING', () => {
      expect(service.isValidTransition('UPLOADED', 'THUMBNAILING')).toBe(true);
    });

    it('should allow THUMBNAILING → TAGGING', () => {
      expect(service.isValidTransition('THUMBNAILING', 'TAGGING')).toBe(true);
    });

    it('should allow THUMBNAILING → THUMBNAIL_FAILED', () => {
      expect(service.isValidTransition('THUMBNAILING', 'THUMBNAIL_FAILED')).toBe(true);
    });

    it('should allow TAGGING → COMPLETED', () => {
      expect(service.isValidTransition('TAGGING', 'COMPLETED')).toBe(true);
    });

    it('should allow FAILED → UPLOADED (retry)', () => {
      expect(service.isValidTransition('FAILED', 'UPLOADED')).toBe(true);
    });

    it('should allow THUMBNAIL_FAILED → UPLOADED (retry)', () => {
      expect(service.isValidTransition('THUMBNAIL_FAILED', 'UPLOADED')).toBe(true);
    });

    it('should allow PROCESSING → THUMBNAILING (legacy)', () => {
      expect(service.isValidTransition('PROCESSING', 'THUMBNAILING')).toBe(true);
    });

    it('should allow READY → TAGGING (legacy)', () => {
      expect(service.isValidTransition('READY', 'TAGGING')).toBe(true);
    });

    it('should reject UPLOADED → COMPLETED (jump)', () => {
      expect(service.isValidTransition('UPLOADED', 'COMPLETED')).toBe(false);
    });

    it('should reject THUMBNAILING → UPLOADED (backwards)', () => {
      expect(service.isValidTransition('THUMBNAILING', 'UPLOADED')).toBe(false);
    });

    it('should reject COMPLETED to anything', () => {
      expect(service.isValidTransition('COMPLETED', 'UPLOADED')).toBe(false);
    });

    it('should reject unknown statuses', () => {
      expect(service.isValidTransition('INVALID', 'UPLOADED')).toBe(false);
    });
  });

  describe('transition', () => {
    const mockPrisma = {
      photo: {
        updateMany: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    it('should transition photo when status matches', async () => {
      mockPrisma.photo.updateMany.mockResolvedValue({ count: 1 });

      await service.transition('photo-1', ['UPLOADED'], 'THUMBNAILING', mockPrisma);

      expect(mockPrisma.photo.updateMany).toHaveBeenCalledWith({
        where: { id: 'photo-1', status: { in: ['UPLOADED'] } },
        data: { status: 'THUMBNAILING' },
      });
    });

    it('should throw when photo is not in fromStatus', async () => {
      mockPrisma.photo.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.photo.findUnique.mockResolvedValue({ status: 'COMPLETED' });

      await expect(
        service.transition('photo-1', ['UPLOADED'], 'THUMBNAILING', mockPrisma),
      ).rejects.toThrow('Cannot transition photo photo-1 from status COMPLETED to THUMBNAILING');
    });

    it('should throw when photo does not exist', async () => {
      mockPrisma.photo.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.photo.findUnique.mockResolvedValue(null);

      await expect(
        service.transition('non-existent', ['UPLOADED'], 'THUMBNAILING', mockPrisma),
      ).rejects.toThrow('Photo not found: non-existent');
    });

    it('should accept multiple fromStatuses', async () => {
      mockPrisma.photo.updateMany.mockResolvedValue({ count: 1 });

      await service.transition(
        'photo-1',
        ['UPLOADED', 'PROCESSING'],
        'THUMBNAILING',
        mockPrisma,
      );

      expect(mockPrisma.photo.updateMany).toHaveBeenCalledWith({
        where: { id: 'photo-1', status: { in: ['UPLOADED', 'PROCESSING'] } },
        data: { status: 'THUMBNAILING' },
      });
    });
  });

  describe('startLockRefresh / stopLockRefresh', () => {
    it('should return a timer that can be stopped', () => {
      jest.useFakeTimers();

      const lockValue = 'test-lock';
      jest.spyOn(service, 'refreshLock').mockResolvedValue(true);

      const timer = service.startLockRefresh('photo-1', lockValue);
      expect(timer).toBeDefined();

      jest.advanceTimersByTime(30000);
      expect(service.refreshLock).toHaveBeenCalledWith('photo-1', lockValue);

      service.stopLockRefresh(timer);
      jest.advanceTimersByTime(30000);
      expect(service.refreshLock).toHaveBeenCalledTimes(1);

      jest.useRealTimers();
    });
  });
});
