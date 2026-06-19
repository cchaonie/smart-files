import { Injectable } from '@nestjs/common';

export interface CycleSummary {
  duration: number;
  scanned: number;
  orphans: number;
  quarantined: number;
  timestamp: string;
}

@Injectable()
export class StorageMetricsService {
  private counters = new Map<string, number>();
  private lastRun: CycleSummary | null = null;

  incrementCounter(name: string): void {
    this.counters.set(name, (this.counters.get(name) || 0) + 1);
  }

  getCounters(): Record<string, number> {
    return Object.fromEntries(this.counters);
  }

  resetCounters(): void {
    this.counters.clear();
  }

  recordCycle(summary: Omit<CycleSummary, 'timestamp'>): void {
    this.lastRun = { ...summary, timestamp: new Date().toISOString() };
  }

  getLastRun(): CycleSummary | null {
    return this.lastRun;
  }
}
