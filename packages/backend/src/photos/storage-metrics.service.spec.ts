import { Test, TestingModule } from '@nestjs/testing';
import { StorageMetricsService } from './storage-metrics.service';

describe('StorageMetricsService', () => {
  let service: StorageMetricsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StorageMetricsService],
    }).compile();

    service = module.get<StorageMetricsService>(StorageMetricsService);
  });

  describe('incrementCounter / getCounters', () => {
    it('should start with empty counters', () => {
      expect(service.getCounters()).toEqual({});
    });

    it('should increment a counter', () => {
      service.incrementCounter('storage.orphans.total');
      expect(service.getCounters()).toEqual({ 'storage.orphans.total': 1 });
    });

    it('should increment a counter multiple times', () => {
      service.incrementCounter('storage.orphans.total');
      service.incrementCounter('storage.orphans.total');
      expect(service.getCounters()).toEqual({ 'storage.orphans.total': 2 });
    });

    it('should handle multiple named counters', () => {
      service.incrementCounter('storage.orphans.total');
      service.incrementCounter('storage.orphans.skipped_large');
      service.incrementCounter('storage.orphans.total');
      expect(service.getCounters()).toEqual({
        'storage.orphans.total': 2,
        'storage.orphans.skipped_large': 1,
      });
    });
  });

  describe('resetCounters', () => {
    it('should clear all counters', () => {
      service.incrementCounter('storage.orphans.total');
      service.resetCounters();
      expect(service.getCounters()).toEqual({});
    });
  });

  describe('recordCycle / getLastRun', () => {
    it('should start with no last run', () => {
      expect(service.getLastRun()).toBeNull();
    });

    it('should record a cycle summary', () => {
      service.recordCycle({
        duration: 1234,
        scanned: 500,
        orphans: 5,
        quarantined: 2,
      });

      const lastRun = service.getLastRun();
      expect(lastRun).toEqual({
        duration: 1234,
        scanned: 500,
        orphans: 5,
        quarantined: 2,
        timestamp: expect.any(String),
      });
    });

    it('should overwrite previous last run', () => {
      service.recordCycle({
        duration: 1000,
        scanned: 100,
        orphans: 2,
        quarantined: 1,
      });
      service.recordCycle({
        duration: 2000,
        scanned: 200,
        orphans: 4,
        quarantined: 3,
      });

      expect(service.getLastRun()!.duration).toBe(2000);
      expect(service.getLastRun()!.scanned).toBe(200);
    });
  });
});
