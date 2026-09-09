import type { ConfigService } from '@nestjs/config';
import type {
  CommentAbuseMetricsPort,
  CommentAbuseRateLimitStorePort,
} from '../../application/ports';
import { RedisCommentAbuseGuardAdapter } from './redis-comment-abuse-guard.adapter';

describe('RedisCommentAbuseGuardAdapter', () => {
  const metrics: jest.Mocked<CommentAbuseMetricsPort> = {
    recordBlock: jest.fn(),
  };

  beforeEach(() => metrics.recordBlock.mockReset());

  it('shares block and chapter quotas across root/reply writes while isolating users and chapters', async () => {
    const counters = new Map<string, number>();
    const limiter = new RedisCommentAbuseGuardAdapter(
      {
        available: true,
        consume: (key, ttlSeconds) => {
          const count = (counters.get(key) ?? 0) + 1;
          counters.set(key, count);
          return Promise.resolve({ count, ttlSeconds });
        },
      },
      configService({
        COMMENT_ABUSE_RATE_LIMIT_ENABLED: true,
        COMMENT_WRITE_MINUTE_LIMIT: 100,
      }),
      metrics,
    );
    const write = (
      user = 'reader',
      chapterId = 'chapter',
      anchorBlockId = 'block',
    ) =>
      limiter.consume('comment-write', user, undefined, {
        chapterId,
        anchorBlockId,
      });
    for (let index = 0; index < 3; index++) await write();
    await expect(write()).rejects.toMatchObject({
      code: 'COMMENT_ABUSE_RATE_LIMITED',
      retryAfterSeconds: 3600,
      details: { limit: 3, scope: 'block' },
    });
    await expect(write('other-reader')).resolves.toBeUndefined();
    await expect(write('reader', 'other-chapter')).resolves.toBeUndefined();
    for (let index = 0; index < 6; index++)
      await write('reader', 'chapter', `other-block-${index}`);
    await expect(
      write('reader', 'chapter', 'fresh-block'),
    ).rejects.toMatchObject({
      code: 'COMMENT_ABUSE_RATE_LIMITED',
      details: { limit: 10, scope: 'chapter' },
    });
  });

  it('fails closed when a contextual counter cannot be read', async () => {
    const limiter = new RedisCommentAbuseGuardAdapter(
      {
        available: true,
        consume: (key) => {
          if (key.startsWith('abuse:chapter:'))
            return Promise.reject(new Error('Redis unavailable'));
          return Promise.resolve({ count: 1, ttlSeconds: 60 });
        },
      },
      configService({ COMMENT_ABUSE_RATE_LIMIT_ENABLED: true }),
      metrics,
    );
    await expect(
      limiter.consume('comment-write', 'reader', undefined, {
        chapterId: 'chapter',
      }),
    ).rejects.toMatchObject({ code: 'ABUSE_PROTECTION_UNAVAILABLE' });
  });

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
    const limiter = new RedisCommentAbuseGuardAdapter(store, config, metrics);

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
    expect(metrics.recordBlock.mock.calls).toContainEqual(['comment']);
  });

  it('fails closed when protection is enabled but the backing store is unavailable', async () => {
    const store: CommentAbuseRateLimitStorePort = {
      available: false,
      consume: jest.fn(),
    };
    const limiter = new RedisCommentAbuseGuardAdapter(
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
