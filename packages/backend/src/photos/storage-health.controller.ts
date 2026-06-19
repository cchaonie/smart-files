import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { StorageMetricsService } from './storage-metrics.service';

@UseGuards(JwtAuthGuard)
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
