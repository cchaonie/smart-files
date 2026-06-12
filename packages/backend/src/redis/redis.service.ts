import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnApplicationShutdown {
  private client: Redis;
  private connected = false;

  constructor() {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    this.client = new Redis(url, {
      maxRetriesPerRequest: null,
      retryStrategy: (times) => {
        if (times > 10) return null; // give up after 10 retries
        return Math.min(times * 200, 3000); // backoff up to 3s
      },
      lazyConnect: true,
    });

    this.client.on('connect', () => {
      this.connected = true;
    });

    this.client.on('close', () => {
      this.connected = false;
    });

    this.client.on('error', (err) => {
      // BullMQ handles its own reconnection; just log
      console.error('Redis connection error:', err.message);
    });
  }

  /**
   * Check connectivity by sending PING.
   */
  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  /**
   * Get the underlying ioredis client (for BullMQ or direct use).
   */
  getClient(): Redis {
    return this.client;
  }

  async onApplicationShutdown(): Promise<void> {
    await this.client.quit();
  }
}
