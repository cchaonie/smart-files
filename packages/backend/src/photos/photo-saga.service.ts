import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { v4 as uuidv4 } from 'uuid';

const VALID_TRANSITIONS: Record<string, string[]> = {
  UPLOADED: ['THUMBNAILING'],
  THUMBNAILING: ['TAGGING', 'THUMBNAIL_FAILED'],
  TAGGING: ['COMPLETED'],
  COMPLETED: [],
  THUMBNAIL_FAILED: ['THUMBNAILING', 'UPLOADED'],
  FAILED: ['UPLOADED'],
  PROCESSING: ['THUMBNAILING'],
  READY: ['TAGGING'],
};

const LOCK_PREFIX = 'photo:lock:';
const DEFAULT_LOCK_TTL_MS = 5 * 60 * 1000;
const REFRESH_INTERVAL_MS = 30 * 1000;

@Injectable()
export class PhotoSagaService {
  private readonly logger = new Logger(PhotoSagaService.name);

  constructor(private redisService: RedisService) {}

  async acquireLock(photoId: string, ttlMs?: number): Promise<string | null> {
    const client = this.redisService.getClient();
    const lockKey = this.lockKey(photoId);
    const lockValue = uuidv4();
    const ttl = ttlMs ?? DEFAULT_LOCK_TTL_MS;

    const acquired = await client.set(lockKey, lockValue, 'PX', ttl, 'NX');
    return acquired === 'OK' ? lockValue : null;
  }

  async releaseLock(photoId: string, lockValue: string): Promise<void> {
    const client = this.redisService.getClient();
    const lockKey = this.lockKey(photoId);

    const script = `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("DEL", KEYS[1])
      end
      return 0
    `;
    await client.eval(script, 1, lockKey, lockValue);
  }

  async refreshLock(photoId: string, lockValue: string, ttlMs?: number): Promise<boolean> {
    const client = this.redisService.getClient();
    const lockKey = this.lockKey(photoId);
    const ttl = ttlMs ?? DEFAULT_LOCK_TTL_MS;

    const script = `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("PEXPIRE", KEYS[1], ARGV[2])
      end
      return 0
    `;
    const result = await client.eval(script, 1, lockKey, lockValue, String(ttl));
    return result === 1;
  }

  startLockRefresh(photoId: string, lockValue: string): NodeJS.Timeout {
    const timer = setInterval(() => {
      this.refreshLock(photoId, lockValue).catch(() => {
        this.logger.warn(`Failed to refresh lock for photo ${photoId}`);
      });
    }, REFRESH_INTERVAL_MS);
    timer.unref();
    return timer;
  }

  stopLockRefresh(timer: NodeJS.Timeout): void {
    clearInterval(timer);
  }

  isValidTransition(from: string, to: string): boolean {
    const allowed = VALID_TRANSITIONS[from];
    return allowed ? allowed.includes(to) : false;
  }

  async transition(
    photoId: string,
    fromStatuses: string[],
    toStatus: string,
    prisma: any,
  ): Promise<void> {
    for (const from of fromStatuses) {
      if (!this.isValidTransition(from, toStatus)) {
        this.logger.warn(`Invalid transition attempted: ${from} → ${toStatus} for photo ${photoId}`);
      }
    }

    const result = await prisma.photo.updateMany({
      where: { id: photoId, status: { in: fromStatuses } },
      data: { status: toStatus },
    });

    if (result.count === 0) {
      const photo = await prisma.photo.findUnique({
        where: { id: photoId },
        select: { status: true },
      });
      if (!photo) {
        throw new Error(`Photo not found: ${photoId}`);
      }
      throw new Error(
        `Cannot transition photo ${photoId} from status ${photo.status} to ${toStatus}`,
      );
    }
  }

  private lockKey(photoId: string): string {
    return `${LOCK_PREFIX}${photoId}`;
  }
}
