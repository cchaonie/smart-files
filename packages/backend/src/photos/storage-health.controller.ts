import { Controller, Get } from '@nestjs/common';
import { StorageMetricsService } from './storage-metrics.service';

@Controller('health')
export class StorageHealthController {
  constructor(private readonly metrics: StorageMetricsService) {}

  @Get('storage')
  getStorageHealth() {
    return {
      status: 'ok',
      service: 'storage',
      metrics: this.metrics.getCounters(),
      lastReconcilerRun: this.metrics.getLastRun(),
      timestamp: new Date().toISOString(),
    };
  }
}
