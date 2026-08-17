import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '@/infrastructure/cache/redis/redis.constants';
import type { CommentAbuseRateLimitStorePort } from '../../application';

@Injectable()
export class RedisCommentAbuseRateLimitStoreAdapter
  implements CommentAbuseRateLimitStorePort
{
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis | null) {}

  get available(): boolean {
    return this.redis !== null;
  }

  async consume(
    key: string,
    windowSeconds: number,
  ): Promise<{ readonly count: number; readonly ttlSeconds: number }> {
    if (!this.redis) throw new Error('Redis client is unavailable');
    const script = `
      local current = redis.call('INCR', KEYS[1])
      if current == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
      local ttl = redis.call('TTL', KEYS[1])
      return { current, ttl }
    `;
    const raw = (await this.redis.eval(
      script,
      1,
      key,
      String(windowSeconds),
    )) as [number, number];
    return {
      count: Number(raw[0]),
      ttlSeconds: Math.max(1, Number(raw[1]) || windowSeconds),
    };
  }
}
