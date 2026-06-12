import { Injectable, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnApplicationShutdown, OnModuleInit {
  private client: Redis;

  constructor(private configService: ConfigService) {
    const url =
      this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    this.client = new Redis(url, {
      maxRetriesPerRequest: null,
      retryStrategy: (times) => {
        return Math.min(times * 200, 3000); // unlimited retries, backoff up to 3s
      },
      connectTimeout: 10000,
      lazyConnect: false, // start connecting immediately (fail-fast)
    });

    this.client.on('ready', () => {
      console.log('Redis connected successfully');
    });

    this.client.on('close', () => {
      console.warn('Redis connection closed');
    });

    this.client.on('error', (err) => {
      console.error('Redis connection error:', err.message);
    });
  }

  async onModuleInit(): Promise<void> {
    // Fail-fast: if ping doesn't succeed within 15s, crash the service.
    // The underlying ioredis client keeps retrying for BullMQ in the
    // background — this timeout provides the fast-failure boundary.
    const ok = await Promise.race([
      this.ping(),
      new Promise<boolean>((resolve) => {
        setTimeout(() => resolve(false), 15000);
      }),
    ]);
    if (!ok) {
      throw new Error(
        'Redis connection failed — application cannot start without Redis',
      );
    }
  }

  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  getClient(): Redis {
    return this.client;
  }

  async onApplicationShutdown(): Promise<void> {
    try {
      await this.client.quit();
    } catch (err) {
      console.error('Error shutting down Redis connection:', err);
    }
  }
}
