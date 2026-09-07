import type { MonetizationConfig } from '@/config';

import { RedisMonetizationRateLimiter } from './redis-monetization-rate-limiter';

const enabledConfig = { enabled: true } as MonetizationConfig;

describe('RedisMonetizationRateLimiter', () => {
  it('uses a bounded hashed Redis bucket', async () => {
    const redis = { eval: jest.fn().mockResolvedValue([1, 60]) };
    const limiter = new RedisMonetizationRateLimiter(
      redis as never,
      enabledConfig,
    );

    await limiter.consume({ operation: 'chapter_unlock', subject: 'USER-1' });

    expect(redis.eval).toHaveBeenCalledWith(
      expect.any(String),
      1,
      expect.stringMatching(
        /^monetization:rate-limit:v1:chapter_unlock:[a-f0-9]{32}$/u,
      ),
      '60',
    );
  });

  it('fails closed when Redis protection is unavailable', async () => {
    const limiter = new RedisMonetizationRateLimiter(null, enabledConfig);

    await expect(
      limiter.consume({ operation: 'order_create', subject: 'user-1' }),
    ).rejects.toMatchObject({ code: 'MONETIZATION_PROTECTION_UNAVAILABLE' });
  });

  it('fails closed when Redis rejects the atomic bucket operation', async () => {
    const redis = {
      eval: jest.fn().mockRejectedValue(new Error('redis down')),
    };
    const limiter = new RedisMonetizationRateLimiter(
      redis as never,
      enabledConfig,
    );

    await expect(
      limiter.consume({ operation: 'chapter_unlock', subject: 'user-1' }),
    ).rejects.toMatchObject({ code: 'MONETIZATION_PROTECTION_UNAVAILABLE' });
  });

  it('returns retry metadata after the operation limit', async () => {
    const redis = { eval: jest.fn().mockResolvedValue([7, 41]) };
    const limiter = new RedisMonetizationRateLimiter(
      redis as never,
      enabledConfig,
    );

    await expect(
      limiter.consume({ operation: 'order_create', subject: 'user-1' }),
    ).rejects.toMatchObject({
      code: 'MONETIZATION_RATE_LIMITED',
      retryAfterSeconds: 41,
    });
  });

  it('does not require Redis while monetization is disabled', async () => {
    const limiter = new RedisMonetizationRateLimiter(null, {
      enabled: false,
    } as MonetizationConfig);

    await expect(
      limiter.consume({ operation: 'payment_webhook', subject: 'provider' }),
    ).resolves.toBeUndefined();
  });
});
