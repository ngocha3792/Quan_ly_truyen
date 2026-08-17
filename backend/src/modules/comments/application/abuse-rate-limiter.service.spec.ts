import type { ConfigService } from '@nestjs/config';
import type {
  CommentAbuseMetricsPort,
  CommentAbuseRateLimitStorePort,
} from './ports';
import { AbuseRateLimiterService } from './abuse-rate-limiter.service';

describe('AbuseRateLimiterService', () => {
  const metrics: jest.Mocked<CommentAbuseMetricsPort> = {
    recordBlock: jest.fn(),
  };

  beforeEach(() => metrics.recordBlock.mockReset());

  it('shares the configured comment-write bucket and returns usable retry information', async () => {
    const counters = new Map<string, number>();
    const store: CommentAbuseRateLimitStorePort = {
      available: true,
      consume: jest.fn((key: string, windowSeconds: number) => {
        const next = (counters.get(key) ?? 0) + 1;
        counters.set(key, next);
        return Promise.resolve({ count: next, ttlSeconds: windowSeconds });
      }),
    };
    const config = configService({
      COMMENT_ABUSE_RATE_LIMIT_ENABLED: true,
      COMMENT_WRITE_MINUTE_LIMIT: 10,
      COMMENT_WRITE_HOUR_LIMIT: 50,
    });
    const limiter = new AbuseRateLimiterService(store, config, metrics);

    for (let index = 0; index < 10; index += 1) {
      await expect(
        limiter.consume('comment-write', 'user-a'),
      ).resolves.toBeUndefined();
    }
    await expect(
      limiter.consume('comment-write', 'user-a'),
    ).rejects.toMatchObject({
      code: 'COMMENT_ABUSE_RATE_LIMITED',
      retryAfterSeconds: 60,
    });
    expect(metrics.recordBlock).toHaveBeenCalledWith('comment');
  });

  it('fails closed when protection is enabled but the backing store is unavailable', async () => {
    const store: CommentAbuseRateLimitStorePort = {
      available: false,
      consume: jest.fn(),
    };
    const limiter = new AbuseRateLimiterService(
      store,
      configService({ COMMENT_ABUSE_RATE_LIMIT_ENABLED: true }),
      metrics,
    );
    await expect(limiter.consume('report', 'user-a')).rejects.toMatchObject({
      code: 'ABUSE_PROTECTION_UNAVAILABLE',
    });
  });
});

function configService(
  values: Readonly<Record<string, unknown>>,
): ConfigService {
  return { get: (key: string) => values[key] } as ConfigService;
}
