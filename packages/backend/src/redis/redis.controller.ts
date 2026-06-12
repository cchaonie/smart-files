import { Controller, Get } from '@nestjs/common';
import { RedisService } from './redis.service';

@Controller('health')
export class RedisController {
  constructor(private readonly redisService: RedisService) {}

  @Get('redis')
  async checkRedis() {
    const ok = await this.redisService.ping();
    return {
      status: ok ? 'ok' : 'error',
      service: 'redis',
      timestamp: new Date().toISOString(),
    };
  }
}
