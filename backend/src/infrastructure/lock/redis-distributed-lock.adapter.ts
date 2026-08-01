import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';

import {
  ConcurrencyConflictException,
  InvalidInputException,
  ServiceUnavailableException,
} from '@/common/exceptions';
import { REDIS_CLIENT } from '@/infrastructure/cache/redis/redis.constants';
import {
  MANUAL_SPANS,
  MetricsService,
  TracingService,
} from '@/infrastructure/observability';
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

const EXTEND_LUA_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("pexpire", KEYS[1], ARGV[2])
else
  return 0
end
`;

@Injectable()
export class RedisDistributedLock implements DistributedLock {
  private readonly logger = new Logger(RedisDistributedLock.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis | null,
    private readonly metrics: MetricsService,
    private readonly tracing: TracingService,
  ) {}

  async withLock<T>(
    key: string,
    options: LockOptions,
    work: () => Promise<T>,
  ): Promise<T> {
    return this.tracing.inSpan(
      MANUAL_SPANS.LOCK_ACQUIRE,
      { 'lock.system': 'redis' },
      () => this.withLockInternal(key, options, work),
    );
  }

  private async withLockInternal<T>(
    key: string,
    options: LockOptions,
    work: () => Promise<T>,
  ): Promise<T> {
    this.validateOptions(options);
    if (!this.redisClient) {
      this.metrics.recordLock('acquire', 'failed', 0);
      this.metrics.recordRedisError('lock');
      throw new ServiceUnavailableException({
        code: 'DISTRIBUTED_LOCK_UNAVAILABLE',
        service: 'redis-lock',
        message: 'Distributed lock protection is unavailable',
      });
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
        this.metrics.recordLock(
          'acquire',
          'success',
          (Date.now() - startTime) / 1000,
        );
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
      this.metrics.recordLock(
        'acquire',
        'conflict',
        (Date.now() - startTime) / 1000,
      );
      throw new ConcurrencyConflictException({
        resource: key,
        message: `Không thể khóa tài nguyên [${key}] do xung đột tiến trình`,
      });
    }

    let stopped = false;
    let leaseLost = false;
    let heartbeatTimer: NodeJS.Timeout | undefined;
    let heartbeatPromise: Promise<void> | undefined;
    const extensionIntervalMs =
      options.extensionIntervalMs ?? Math.floor(options.ttlMs / 3);

    const scheduleHeartbeat = (): void => {
      if (stopped || options.autoExtend === false) return;
      heartbeatTimer = setTimeout(() => {
        heartbeatPromise = this.extendLock(lockKey, ownerToken, options.ttlMs)
          .then((extended) => {
            if (!extended) {
              leaseLost = true;
              this.metrics.recordLock('extend', 'ownership_lost');
              this.logger.warn({ event: 'distributed_lock.lease_lost' });
            } else {
              this.metrics.recordLock('extend', 'success');
            }
          })
          .catch((error: unknown) => {
            leaseLost = true;
            this.metrics.recordLock('extend', 'failed');
            this.metrics.recordRedisError('lock');
            this.logger.warn({
              event: 'distributed_lock.extend.failed',
              'error.type':
                error instanceof Error ? error.name : 'UnknownError',
            });
          })
          .finally(() => {
            heartbeatPromise = undefined;
            if (!leaseLost) scheduleHeartbeat();
          });
      }, extensionIntervalMs);
      heartbeatTimer.unref();
    };

    scheduleHeartbeat();
    let outcome:
      { success: true; value: T } | { success: false; error: unknown };
    try {
      outcome = { success: true, value: await work() };
    } catch (error: unknown) {
      outcome = { success: false, error };
    } finally {
      stopped = true;
      if (heartbeatTimer) clearTimeout(heartbeatTimer);
      if (heartbeatPromise) await heartbeatPromise;
      await this.releaseLock(lockKey, ownerToken);
    }
    if (leaseLost) {
      throw new ConcurrencyConflictException({
        resource: key,
        message: `Distributed lock lease was lost for [${key}]`,
      });
    }
    if (!outcome.success) throw outcome.error;
    return outcome.value;
  }

  private validateOptions(options: LockOptions): void {
    const extensionIntervalMs =
      options.extensionIntervalMs ?? Math.floor(options.ttlMs / 3);
    if (
      !Number.isInteger(options.ttlMs) ||
      options.ttlMs < 100 ||
      !Number.isInteger(extensionIntervalMs) ||
      extensionIntervalMs < 25 ||
      extensionIntervalMs >= options.ttlMs
    ) {
      throw new InvalidInputException({
        message:
          'Lock ttlMs must be at least 100ms and extensionIntervalMs must be between 25ms and ttlMs',
      });
    }
  }

  private async extendLock(
    lockKey: string,
    ownerToken: string,
    ttlMs: number,
  ): Promise<boolean> {
    if (!this.redisClient) return false;
    const result = await this.redisClient.eval(
      EXTEND_LUA_SCRIPT,
      1,
      lockKey,
      ownerToken,
      String(ttlMs),
    );
    return Number(result) === 1;
  }

  private async releaseLock(
    lockKey: string,
    ownerToken: string,
  ): Promise<void> {
    if (!this.redisClient) {
      return;
    }

    try {
      const released = await this.redisClient.eval(
        RELEASE_LUA_SCRIPT,
        1,
        lockKey,
        ownerToken,
      );
      this.metrics.recordLock(
        'release',
        Number(released) === 1 ? 'success' : 'ownership_lost',
      );
    } catch (error: unknown) {
      this.metrics.recordLock('release', 'failed');
      this.metrics.recordRedisError('lock');
      this.logger.warn({
        event: 'distributed_lock.release.failed',
        'error.type': error instanceof Error ? error.name : 'UnknownError',
      });
    }
  }
}
