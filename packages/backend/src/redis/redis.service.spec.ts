import { RedisService } from './redis.service';

describe('RedisService', () => {
  let service: RedisService;

  afterEach(async () => {
    if (service) {
      await service.onApplicationShutdown();
    }
  });

  it('should be defined', () => {
    service = new RedisService();
    expect(service).toBeDefined();
  });

  it('should return a Redis client instance', () => {
    service = new RedisService();
    const client = service.getClient();
    expect(client).toBeDefined();
  });

  it('should ping Redis and return a boolean', async () => {
    service = new RedisService();
    const result = await service.ping();
    expect(typeof result).toBe('boolean');
  }, 10000);
});
