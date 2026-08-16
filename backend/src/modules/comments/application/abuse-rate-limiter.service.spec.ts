import type { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
import { AbuseRateLimiterService } from './abuse-rate-limiter.service';

describe('AbuseRateLimiterService', () => {
  const metrics = { recordCommentAbuseBlock: jest.fn() };

  beforeEach(() => metrics.recordCommentAbuseBlock.mockReset());

  it('shares the configured comment-write bucket and returns usable retry information', async () => {
    const counters = new Map<string, number>();
    const redis = {
      eval: jest.fn(async (_script: string, _keyCount: number, key: string, windowSeconds: string) => {
        const next = (counters.get(key) ?? 0) + 1;
        counters.set(key, next);
        return [next, Number(windowSeconds)];
      }),
    } as unknown as Redis;
    const config = configService({
      COMMENT_ABUSE_RATE_LIMIT_ENABLED: true,
      COMMENT_WRITE_MINUTE_LIMIT: 10,
      COMMENT_WRITE_HOUR_LIMIT: 50,
    });
    const limiter = new AbuseRateLimiterService(redis, config, metrics as never);

    for (let index = 0; index < 10; index += 1) {
      await expect(limiter.consume('comment-write', 'user-a')).resolves.toBeUndefined();
    }
    await expect(limiter.consume('comment-write', 'user-a')).rejects.toMatchObject({
      code: 'COMMENT_ABUSE_RATE_LIMITED',
      retryAfterSeconds: 60,
    });
    expect(metrics.recordCommentAbuseBlock).toHaveBeenCalledWith('comment');
  });

  it('fails closed when protection is enabled but Redis is unavailable', async () => {
    const limiter = new AbuseRateLimiterService(
      null,
      configService({ COMMENT_ABUSE_RATE_LIMIT_ENABLED: true }),
      metrics as never,
    );
    await expect(limiter.consume('report', 'user-a')).rejects.toMatchObject({
      code: 'ABUSE_PROTECTION_UNAVAILABLE',
    });
  });
});

function configService(values: Readonly<Record<string, unknown>>): ConfigService {
  return { get: (key: string) => values[key] } as ConfigService;
}
