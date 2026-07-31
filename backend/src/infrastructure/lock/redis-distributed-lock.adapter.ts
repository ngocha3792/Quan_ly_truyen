import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';

import { ConcurrencyConflictException } from '@/common/exceptions';
import { REDIS_CLIENT } from '@/infrastructure/cache/redis/redis.constants';
import type {
  DistributedLock,
  LockOptions,
} from './distributed-lock.interface';

const RELEASE_LUA_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

@Injectable()
export class RedisDistributedLock implements DistributedLock {
  private readonly logger = new Logger(RedisDistributedLock.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis | null,
  ) {}

  async withLock<T>(
    key: string,
    options: LockOptions,
    work: () => Promise<T>,
  ): Promise<T> {
    if (!this.redisClient) {
      this.logger.warn(
        'Redis is unavailable for DistributedLock, executing work without distributed lock protection',
      );
      return work();
    }

    const lockKey = `lock:${key}`;
    const ownerToken = randomUUID();
    const startTime = Date.now();
    const waitMs = options.waitMs ?? 0;

    let acquired = false;

    while (!acquired) {
      const result = await this.redisClient.set(
        lockKey,
        ownerToken,
        'PX',
        options.ttlMs,
        'NX',
      );

      if (result === 'OK') {
        acquired = true;
        break;
      }

      const elapsed = Date.now() - startTime;
      if (elapsed >= waitMs) {
        break;
      }

      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(50, waitMs - elapsed)),
      );
    }

    if (!acquired) {
      throw new ConcurrencyConflictException({
        resource: key,
        message: `Không thể khóa tài nguyên [${key}] do xung đột tiến trình`,
      });
    }

    try {
      return await work();
    } finally {
      await this.releaseLock(lockKey, ownerToken);
    }
  }

  private async releaseLock(
    lockKey: string,
    ownerToken: string,
  ): Promise<void> {
    if (!this.redisClient) {
      return;
    }

    try {
      await this.redisClient.eval(RELEASE_LUA_SCRIPT, 1, lockKey, ownerToken);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown lock release error';
      this.logger.warn(`Failed to release lock [${lockKey}]: ${message}`);
    }
  }
}
