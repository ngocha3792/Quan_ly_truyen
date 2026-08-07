import type { AuthConfig } from '@/config';

import { sha256 } from '@/common/utils';

import { RedisJwtBlacklist } from './redis-jwt-blacklist';

describe('RedisJwtBlacklist', () => {
  const tokenId = '11111111-1111-4111-8111-111111111111';

  let redis: {
    exists: jest.Mock<Promise<number>, [string]>;

    set: jest.Mock<Promise<string | null>, [string, string, string, number]>;
  };

  beforeEach(() => {
    jest.useFakeTimers();

    jest.setSystemTime(new Date('2026-08-03T04:00:00.000Z'));

    redis = {
      exists: jest.fn<Promise<number>, [string]>(),

      set: jest.fn<Promise<string | null>, [string, string, string, number]>(),
    };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns false without calling Redis when blacklist is disabled', async () => {
    const blacklist = createBlacklist(
      redis,

      {
        enabled: false,
      },
    );

    await expect(blacklist.isBlacklisted(tokenId)).resolves.toBe(false);

    expect(redis.exists).not.toHaveBeenCalled();
  });

  it('does not silently succeed when blacklist is disabled', async () => {
    const blacklist = createBlacklist(
      redis,

      {
        enabled: false,
      },
    );

    await expect(
      blacklist.blacklist({
        tokenId,

        expiresAt: new Date('2026-08-03T04:10:00.000Z'),

        reason: 'user_revoked_current_access_token',
      }),
    ).rejects.toMatchObject({
      code: 'AUTH_JWT_BLACKLIST_DISABLED',
    });

    expect(redis.set).not.toHaveBeenCalled();
  });

  it('checks blacklist using a hashed Redis key', async () => {
    redis.exists.mockResolvedValue(1);

    const blacklist = createBlacklist(redis);

    await expect(blacklist.isBlacklisted(tokenId)).resolves.toBe(true);

    expect(redis.exists).toHaveBeenCalledWith(
      ['auth', 'jwt', 'blacklist', sha256(tokenId)].join(':'),
    );

    expect(redis.exists.mock.calls[0][0]).not.toContain(tokenId);
  });

  it('returns false when blacklist key does not exist', async () => {
    redis.exists.mockResolvedValue(0);

    const blacklist = createBlacklist(redis);

    await expect(blacklist.isBlacklisted(tokenId)).resolves.toBe(false);
  });

  it('stores blacklist entry with TTL limited to token expiration', async () => {
    redis.set.mockResolvedValue('OK');

    const blacklist = createBlacklist(redis);

    const expiresAt = new Date('2026-08-03T04:02:00.000Z');

    await blacklist.blacklist({
      tokenId,

      expiresAt,

      reason: 'user_revoked_current_access_token',
    });

    expect(redis.set).toHaveBeenCalledTimes(1);

    expect(redis.set).toHaveBeenCalledWith(
      ['auth', 'jwt', 'blacklist', sha256(tokenId)].join(':'),

      expect.any(String),

      'EX',

      120,
    );

    const storedValue = JSON.parse(redis.set.mock.calls[0][1]) as {
      version: number;

      reason: string;

      blacklistedAt: string;

      expiresAt: string;
    };

    expect(storedValue).toEqual({
      version: 1,

      reason: 'user_revoked_current_access_token',

      blacklistedAt: '2026-08-03T04:00:00.000Z',

      expiresAt: '2026-08-03T04:02:00.000Z',
    });

    expect(JSON.stringify(storedValue)).not.toContain(tokenId);
  });

  it('does not write a blacklist key for an expired token', async () => {
    const blacklist = createBlacklist(redis);

    await expect(
      blacklist.blacklist({
        tokenId,

        expiresAt: new Date('2026-08-03T03:59:59.000Z'),

        reason: 'user_revoked_current_access_token',
      }),
    ).resolves.toBeUndefined();

    expect(redis.set).not.toHaveBeenCalled();
  });

  it('fails open for blacklist reads only when configured', async () => {
    redis.exists.mockRejectedValue(new Error('redis unavailable'));

    const blacklist = createBlacklist(
      redis,

      {
        failureMode: 'open',
      },
    );

    await expect(blacklist.isBlacklisted(tokenId)).resolves.toBe(false);
  });

  it('fails closed for blacklist reads when configured', async () => {
    redis.exists.mockRejectedValue(new Error('redis unavailable'));

    const blacklist = createBlacklist(
      redis,

      {
        failureMode: 'closed',
      },
    );

    await expect(blacklist.isBlacklisted(tokenId)).rejects.toMatchObject({
      code: 'AUTH_JWT_BLACKLIST_UNAVAILABLE',
    });
  });

  it('always fails closed for blacklist writes even when read mode is open', async () => {
    redis.set.mockRejectedValue(new Error('redis unavailable'));

    const blacklist = createBlacklist(
      redis,

      {
        failureMode: 'open',
      },
    );

    await expect(
      blacklist.blacklist({
        tokenId,

        expiresAt: new Date('2026-08-03T04:10:00.000Z'),

        reason: 'user_revoked_current_access_token',
      }),
    ).rejects.toMatchObject({
      code: 'AUTH_JWT_BLACKLIST_UNAVAILABLE',
    });
  });

  it('rejects a Redis SET result different from OK', async () => {
    redis.set.mockResolvedValue(null);

    const blacklist = createBlacklist(redis);

    await expect(
      blacklist.blacklist({
        tokenId,

        expiresAt: new Date('2026-08-03T04:10:00.000Z'),

        reason: 'user_revoked_current_access_token',
      }),
    ).rejects.toMatchObject({
      code: 'AUTH_JWT_BLACKLIST_UNAVAILABLE',
    });
  });

  it('fails closed when Redis client is unavailable', async () => {
    const blacklist = createBlacklist(
      null,

      {
        enabled: true,

        failureMode: 'closed',
      },
    );

    await expect(blacklist.isBlacklisted(tokenId)).rejects.toMatchObject({
      code: 'AUTH_JWT_BLACKLIST_UNAVAILABLE',
    });

    await expect(
      blacklist.blacklist({
        tokenId,

        expiresAt: new Date('2026-08-03T04:10:00.000Z'),

        reason: 'user_revoked_current_access_token',
      }),
    ).rejects.toMatchObject({
      code: 'AUTH_JWT_BLACKLIST_UNAVAILABLE',
    });
  });
});

function createBlacklist(
  redis: {
    exists: jest.Mock<Promise<number>, [string]>;

    set: jest.Mock<Promise<string | null>, [string, string, string, number]>;
  } | null,

  overrides: {
    enabled?: boolean;

    failureMode?: 'closed' | 'open';
  } = {},
): RedisJwtBlacklist {
  const authConfig: AuthConfig = {
    accessTokenSecret: 'access-secret-with-at-least-32-characters',

    refreshTokenSecret: 'refresh-secret-with-at-least-32-characters',

    accessTokenTtlSeconds: 900,

    refreshTokenTtlSeconds: 2_592_000,

    issuer: 'quan-ly-truyen-api',

    audience: 'quan-ly-truyen-web',

    refreshCookie: {
      name: 'refresh_token',

      secure: false,

      sameSite: 'lax',

      path: '/api/v1/auth',
    },

    loginRateLimit: {
      enabled: false,

      windowSeconds: 900,

      ipLimit: 20,

      identifierLimit: 5,
    },

    jwtBlacklist: {
      enabled: overrides.enabled ?? true,

      failureMode: overrides.failureMode ?? 'closed',
    },

    emailVerification: {
      resendCooldownSeconds: 60,
    },

    passwordReset: {
      requestCooldownSeconds: 60,
    },

    adminMfa: {
      enabled: false,
      issuer: 'Quan Ly Truyen',
      encryptionKeyBase64: Buffer.alloc(32, 8).toString('base64'),
      preAuthTicketTtlSeconds: 300,
      maxVerificationAttempts: 5,
      totpWindow: 1,
      recoveryCodeCount: 10,
    },

    oauth: {
      enabled: false,
      stateTtlSeconds: 600,
      stateCookieName: 'oauth_state',
      frontendCallbackUrl: 'http://localhost:3000/auth/oauth/callback',
      google: { enabled: false },
      github: { enabled: false },
    },

    csrf: {
      enabled: true,

      secret: 'csrf-secret-with-at-least-32-characters',

      cookieName: 'csrf_token',

      cookieDomain: undefined,

      cookiePath: '/',
    },

    sessions: {
      maxActiveSessions: 10,

      listLimit: 20,
    },

    audit: {
      historyLimit: 50,
    },
  };

  return new RedisJwtBlacklist(
    {
      getOrThrow: jest.fn().mockReturnValue(authConfig),
    } as never,

    redis as never,
  );
}
