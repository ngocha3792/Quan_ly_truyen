import { randomUUID } from 'node:crypto';

import { ConfigService } from '@nestjs/config';

import Redis from 'ioredis';

import { sha256 } from '@/common/utils';

import type { AuthConfig } from '@/config';

import {
  RedisJwtBlacklist,
  RedisLoginRateLimiter,
} from '@/modules/auth/infrastructure/cache';

describe('Auth Redis integrations', () => {
  let redis: Redis;

  beforeAll(async () => {
    redis = new Redis(requireRedisUrl(), {
      maxRetriesPerRequest: null,

      enableReadyCheck: true,
    });

    await redis.ping();
  });

  beforeEach(async () => {
    /*
     * setup-auth-integration-env bắt buộc
     * Redis database khác DB 0.
     */
    await redis.flushdb();
  });

  afterAll(async () => {
    await redis.flushdb();

    await redis.quit();
  });

  it('increments login limiter atomically and preserves TTL', async () => {
    const limiter = new RedisLoginRateLimiter(
      configService({
        loginRateLimit: {
          enabled: true,

          windowSeconds: 60,

          ipLimit: 100,

          identifierLimit: 100,
        },
      }),

      redis,
    );

    const input = {
      identifier: 'Reader@Example.com',

      ipAddress: '127.0.0.1',
    };

    await Promise.all(
      Array.from(
        {
          length: 20,
        },

        () => limiter.recordFailure(input),
      ),
    );

    const identifierKey = [
      'auth',
      'login',
      'failures',
      'identifier',
      sha256('reader@example.com'),
    ].join(':');

    const ipKey = ['auth', 'login', 'failures', 'ip', sha256('127.0.0.1')].join(
      ':',
    );

    await expect(redis.get(identifierKey)).resolves.toBe('20');

    await expect(redis.get(ipKey)).resolves.toBe('20');

    const identifierTtl = await redis.ttl(identifierKey);

    const ipTtl = await redis.ttl(ipKey);

    expect(identifierTtl).toBeGreaterThan(0);

    expect(identifierTtl).toBeLessThanOrEqual(60);

    expect(ipTtl).toBeGreaterThan(0);

    expect(ipTtl).toBeLessThanOrEqual(60);
  });

  it('blocks at the configured identifier threshold', async () => {
    const limiter = new RedisLoginRateLimiter(
      configService({
        loginRateLimit: {
          enabled: true,

          windowSeconds: 60,

          ipLimit: 100,

          identifierLimit: 3,
        },
      }),

      redis,
    );

    const input = {
      identifier: 'blocked@example.com',
    };

    await expect(limiter.recordFailure(input)).resolves.toBeUndefined();

    await expect(limiter.recordFailure(input)).resolves.toBeUndefined();

    await expect(limiter.recordFailure(input)).rejects.toMatchObject({
      code: 'AUTH_LOGIN_RATE_LIMIT_EXCEEDED',

      details: {
        scope: 'identifier',

        limit: 3,
      },
    });
  });

  it('resets only the identifier counter after login success', async () => {
    const limiter = new RedisLoginRateLimiter(
      configService(),

      redis,
    );

    const input = {
      identifier: 'reader@example.com',

      ipAddress: '127.0.0.1',
    };

    await limiter.recordFailure(input);

    await limiter.resetAfterSuccess(input);

    const identifierKey = [
      'auth',
      'login',
      'failures',
      'identifier',
      sha256('reader@example.com'),
    ].join(':');

    const ipKey = ['auth', 'login', 'failures', 'ip', sha256('127.0.0.1')].join(
      ':',
    );

    await expect(redis.exists(identifierKey)).resolves.toBe(0);

    await expect(redis.exists(ipKey)).resolves.toBe(1);
  });

  it('stores JWT blacklist with TTL bounded by token expiration', async () => {
    jest.useFakeTimers();

    jest.setSystemTime(new Date('2026-08-03T07:00:00.000Z'));

    try {
      const blacklist = new RedisJwtBlacklist(
        configService(),

        redis,
      );

      const tokenId = randomUUID();

      await blacklist.blacklist({
        tokenId,

        expiresAt: new Date('2026-08-03T07:02:00.000Z'),

        reason: 'integration-test',
      });

      await expect(blacklist.isBlacklisted(tokenId)).resolves.toBe(true);

      const key = ['auth', 'jwt', 'blacklist', sha256(tokenId)].join(':');

      const ttl = await redis.ttl(key);

      expect(ttl).toBeGreaterThanOrEqual(119);

      expect(ttl).toBeLessThanOrEqual(120);

      const keys = await redis.keys('auth:jwt:blacklist:*');

      expect(keys).toHaveLength(1);

      expect(keys[0]).not.toContain(tokenId);

      const stored = await redis.get(key);

      expect(stored).not.toContain(tokenId);
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not create a blacklist entry for an expired token', async () => {
    const blacklist = new RedisJwtBlacklist(
      configService(),

      redis,
    );

    await blacklist.blacklist({
      tokenId: randomUUID(),

      expiresAt: new Date(Date.now() - 1_000),

      reason: 'expired-token',
    });

    await expect(redis.dbsize()).resolves.toBe(0);
  });

  function configService(
    overrides: {
      loginRateLimit?: AuthConfig['loginRateLimit'];

      jwtBlacklist?: AuthConfig['jwtBlacklist'];
    } = {},
  ): ConfigService {
    const auth: AuthConfig = {
      accessTokenSecret: 'integration-access-secret-at-least-32-characters',

      refreshTokenSecret: 'integration-refresh-secret-at-least-32-characters',

      accessTokenTtlSeconds: 900,

      refreshTokenTtlSeconds: 2_592_000,

      issuer: 'integration',

      audience: 'integration-client',

      refreshCookie: {
        name: 'refresh_token',

        secure: false,

        sameSite: 'lax',

        path: '/api/v1/auth',
      },

      csrf: {
        enabled: true,

        secret: 'integration-csrf-secret-at-least-32-characters',

        cookieName: 'csrf_token',

        cookiePath: '/',
      },

      loginRateLimit: overrides.loginRateLimit ?? {
        enabled: true,

        windowSeconds: 60,

        ipLimit: 100,

        identifierLimit: 3,
      },

      jwtBlacklist: overrides.jwtBlacklist ?? {
        enabled: true,

        failureMode: 'closed',
      },

      emailVerification: {
        resendCooldownSeconds: 60,
      },

      passwordReset: {
        requestCooldownSeconds: 60,
      },
    };

    return new ConfigService({
      auth,
    });
  }

  function requireRedisUrl(): string {
    const value = process.env.TEST_REDIS_URL;

    if (!value) {
      throw new Error('TEST_REDIS_URL is required');
    }

    return value;
  }
});
