import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
import { RateLimitExceededException } from '@/common/exceptions';
import { REDIS_CLIENT } from '@/infrastructure/cache/redis/redis.constants';
import { MetricsService } from '@/infrastructure/observability';
import { AbuseProtectionUnavailableException } from '../domain';

type Scope = 'comment-write' | 'reaction' | 'report';

@Injectable()
export class AbuseRateLimiterService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis | null,
    private readonly config: ConfigService,
    private readonly metrics: MetricsService,
  ) {}

  get duplicateWindowSeconds(): number {
    return this.number('COMMENT_DUPLICATE_WINDOW_SECONDS', 300);
  }

  get maxLinks(): number {
    return this.number('COMMENT_MAX_LINKS', 3);
  }

  async consume(scope: Scope, userId: string, ipAddress?: string): Promise<void> {
    if (!this.enabled()) return;
    if (!this.redis) throw new AbuseProtectionUnavailableException();

    const buckets = this.buckets(scope);
    const subjects = [`user:${userId}`];
    if (ipAddress?.trim()) subjects.push(`ip:${this.hash(ipAddress)}`);

    try {
      for (const subject of subjects) {
        for (const bucket of buckets) {
          const key = `abuse:${scope}:${subject}:${bucket.windowSeconds}`;
          const result = await this.consumeKey(key, bucket.limit, bucket.windowSeconds);
          if (!result.allowed) {
            this.metrics.recordCommentAbuseBlock(scope === 'comment-write' ? 'comment' : scope);
            throw new RateLimitExceededException({
              code: 'COMMENT_ABUSE_RATE_LIMITED',
              message: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.',
              retryAfterSeconds: result.retryAfterSeconds,
              limit: bucket.limit,
              details: { scope },
            });
          }
        }
      }
    } catch (error: unknown) {
      if (error instanceof RateLimitExceededException) throw error;
      throw new AbuseProtectionUnavailableException();
    }
  }

  private enabled(): boolean {
    return this.config.get<boolean>('COMMENT_ABUSE_RATE_LIMIT_ENABLED') ?? false;
  }

  private buckets(scope: Scope): readonly { limit: number; windowSeconds: number }[] {
    if (scope === 'comment-write') {
      return [
        { limit: this.number('COMMENT_WRITE_MINUTE_LIMIT', 10), windowSeconds: 60 },
        { limit: this.number('COMMENT_WRITE_HOUR_LIMIT', 50), windowSeconds: 3600 },
      ];
    }
    if (scope === 'reaction') {
      return [
        { limit: this.number('COMMENT_REACTION_MINUTE_LIMIT', 30), windowSeconds: 60 },
        { limit: this.number('COMMENT_REACTION_HOUR_LIMIT', 300), windowSeconds: 3600 },
      ];
    }
    return [
      { limit: this.number('COMMENT_REPORT_HOUR_LIMIT', 5), windowSeconds: 3600 },
      { limit: this.number('COMMENT_REPORT_DAY_LIMIT', 20), windowSeconds: 86_400 },
    ];
  }

  private async consumeKey(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
    const script = `
      local current = redis.call('INCR', KEYS[1])
      if current == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
      local ttl = redis.call('TTL', KEYS[1])
      return { current, ttl }
    `;
    const raw = (await this.redis!.eval(script, 1, key, String(windowSeconds))) as [number, number];
    const count = Number(raw[0]);
    const ttl = Math.max(1, Number(raw[1]) || windowSeconds);
    return { allowed: count <= limit, retryAfterSeconds: ttl };
  }

  private number(key: string, fallback: number): number {
    const value = this.config.get<number>(key);
    return Number.isFinite(value) ? Number(value) : fallback;
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex').slice(0, 24);
  }
}
