import { createHash } from 'node:crypto';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
import type { AnalyticsConfig } from '@/config';
import {
  RateLimitExceededException,
  ServiceUnavailableException,
} from '@/common/exceptions';
import { REDIS_CLIENT } from '@/infrastructure/cache/redis/redis.constants';
import { MetricsService } from '@/infrastructure/observability';

@Injectable()
export class AnalyticsRateLimiterService {
  constructor(
    @Optional() @Inject(REDIS_CLIENT) private readonly redis: Redis | null,
    private readonly config: ConfigService,
    private readonly metrics: MetricsService,
  ) {}

  async consume(subject: string, ipAddress?: string): Promise<void> {
    const analytics = this.config.getOrThrow<AnalyticsConfig>('analytics');
    if (!analytics.enabled) return;
    if (!this.redis) {
      throw new ServiceUnavailableException({
        code: 'ANALYTICS_PROTECTION_UNAVAILABLE',
        message: 'Analytics tạm thời không khả dụng',
        service: 'reader-analytics-rate-limit',
      });
    }
    const subjects = [`viewer:${subject}`];
    if (ipAddress?.trim()) subjects.push(`ip:${this.hash(ipAddress)}`);
    const buckets = [
      { seconds: 60, limit: analytics.rateLimitPerMinute },
      { seconds: 3600, limit: analytics.rateLimitPerHour },
    ];
    for (const currentSubject of subjects) {
      for (const bucket of buckets) {
        const key = `analytics:ingest:${currentSubject}:${bucket.seconds}`;
        const [count, ttl] = (await this.redis.eval(
          `local c=redis.call('INCR',KEYS[1]); if c==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return {c,redis.call('TTL',KEYS[1])}`,
          1,
          key,
          String(bucket.seconds),
        )) as [number, number];
        if (Number(count) > bucket.limit) {
          this.metrics.recordReaderAnalyticsRejected('rate_limit');
          throw new RateLimitExceededException({
            code: 'ANALYTICS_RATE_LIMITED',
            message: 'Analytics telemetry bị giới hạn tần suất',
            retryAfterSeconds: Math.max(1, Number(ttl) || bucket.seconds),
            limit: bucket.limit,
            details: { scope: 'reader-analytics' },
          });
        }
      }
    }
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex').slice(0, 24);
  }
}
