import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';

describe('RedisService', () => {
  let service: RedisService;

  afterEach(async () => {
    if (service) {
      await service.onApplicationShutdown();
    }
  });

  it('should be defined', () => {
    const config = new ConfigService({ REDIS_URL: 'redis://localhost:6379' });
    service = new RedisService(config);
    expect(service).toBeDefined();
  });

  it('should return a Redis client instance', () => {
    const config = new ConfigService({ REDIS_URL: 'redis://localhost:6379' });
    service = new RedisService(config);
    const client = service.getClient();
    expect(client).toBeDefined();
    expect(client.status).toBe('connecting'); // lazyConnect: false starts immediately
  });

  it('should ping Redis and return true when server is available', async () => {
    const config = new ConfigService({ REDIS_URL: 'redis://localhost:6379' });
    service = new RedisService(config);
    const result = await service.ping();
    expect(result).toBe(true);
  }, 15000);

  it('should fail onModuleInit when ping returns false', async () => {
    jest.spyOn(RedisService.prototype, 'ping').mockResolvedValue(false);
    const config = new ConfigService({ REDIS_URL: 'redis://localhost:6379' });
    service = new RedisService(config);
    await expect(service.onModuleInit()).rejects.toThrow(
      'Redis connection failed',
    );
    jest.restoreAllMocks();
  });

  it('should fail gracefully when shutdown encounters an error', async () => {
    const config = new ConfigService({ REDIS_URL: 'redis://localhost:6379' });
    service = new RedisService(config);
    // Force-close the underlying connection first so quit() encounters an edge case
    service.getClient().disconnect();
    await expect(service.onApplicationShutdown()).resolves.not.toThrow();
  }, 10000);
});
