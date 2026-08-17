import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RateLimitExceededException } from '@/common/exceptions';
import { AbuseProtectionUnavailableException } from '../domain';
import {
  COMMENT_ABUSE_METRICS_PORT,
  COMMENT_ABUSE_RATE_LIMIT_STORE_PORT,
  type CommentAbuseMetricsPort,
  type CommentAbuseRateLimitStorePort,
} from './ports';

type Scope = 'comment-write' | 'reaction' | 'report';

@Injectable()
export class AbuseRateLimiterService {
  constructor(
    @Inject(COMMENT_ABUSE_RATE_LIMIT_STORE_PORT)
    private readonly store: CommentAbuseRateLimitStorePort,
    private readonly config: ConfigService,
    @Inject(COMMENT_ABUSE_METRICS_PORT)
    private readonly metrics: CommentAbuseMetricsPort,
  ) {}

  get duplicateWindowSeconds(): number {
    return this.number('COMMENT_DUPLICATE_WINDOW_SECONDS', 300);
  }

  get maxLinks(): number {
    return this.number('COMMENT_MAX_LINKS', 3);
  }

  async consume(
    scope: Scope,
    userId: string,
    ipAddress?: string,
  ): Promise<void> {
    if (!this.enabled()) return;
    if (!this.store.available) throw new AbuseProtectionUnavailableException();

    const buckets = this.buckets(scope);
    const subjects = [`user:${userId}`];
    if (ipAddress?.trim()) subjects.push(`ip:${this.hash(ipAddress)}`);

    try {
      for (const subject of subjects) {
        for (const bucket of buckets) {
          const key = `abuse:${scope}:${subject}:${bucket.windowSeconds}`;
          const result = await this.consumeKey(
            key,
            bucket.limit,
            bucket.windowSeconds,
          );
          if (!result.allowed) {
            this.metrics.recordBlock(
              scope === 'comment-write' ? 'comment' : scope,
            );
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
    return (
      this.config.get<boolean>('COMMENT_ABUSE_RATE_LIMIT_ENABLED') ?? false
    );
  }

  private buckets(
    scope: Scope,
  ): readonly { limit: number; windowSeconds: number }[] {
    if (scope === 'comment-write') {
      return [
        {
          limit: this.number('COMMENT_WRITE_MINUTE_LIMIT', 10),
          windowSeconds: 60,
        },
        {
          limit: this.number('COMMENT_WRITE_HOUR_LIMIT', 50),
          windowSeconds: 3600,
        },
      ];
    }
    if (scope === 'reaction') {
      return [
        {
          limit: this.number('COMMENT_REACTION_MINUTE_LIMIT', 30),
          windowSeconds: 60,
        },
        {
          limit: this.number('COMMENT_REACTION_HOUR_LIMIT', 300),
          windowSeconds: 3600,
        },
      ];
    }
    return [
      {
        limit: this.number('COMMENT_REPORT_HOUR_LIMIT', 5),
        windowSeconds: 3600,
      },
      {
        limit: this.number('COMMENT_REPORT_DAY_LIMIT', 20),
        windowSeconds: 86_400,
      },
    ];
  }

  private async consumeKey(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
    const result = await this.store.consume(key, windowSeconds);
    return {
      allowed: result.count <= limit,
      retryAfterSeconds: result.ttlSeconds,
    };
  }

  private number(key: string, fallback: number): number {
    const value = this.config.get<number>(key);
    return Number.isFinite(value) ? Number(value) : fallback;
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex').slice(0, 24);
  }
}
