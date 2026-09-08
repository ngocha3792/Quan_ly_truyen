import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';

import { REDIS_CLIENT } from '@/infrastructure/cache/redis';

import { READING_PROGRESS_RATE_LIMIT_MS } from './reading-progress.events';

@Injectable()
export class ReadingProgressRateLimiter {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis | null) {}

  async accept(userId: string): Promise<boolean> {
    if (!this.redis) return false;
    try {
      const acquired = await this.redis.set(
        `reading-progress:rate-limit:${userId}`,
        '1',
        'PX',
        READING_PROGRESS_RATE_LIMIT_MS,
        'NX',
      );
      return acquired === 'OK';
    } catch {
      return false;
    }
  }
}
