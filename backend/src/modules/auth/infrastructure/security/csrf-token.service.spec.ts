import { AccessDeniedException } from '@/common/exceptions';

import type { AuthConfig } from '@/config';

import { CsrfTokenService } from './csrf-token.service';

describe('CsrfTokenService', () => {
  const refreshToken = 'refresh-token-secret-value';

  beforeEach(() => {
    jest.useFakeTimers();

    jest.setSystemTime(new Date('2026-08-03T05:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('issues and validates a signed token', () => {
    const service = createService();

    const expiresAt = new Date('2026-08-03T05:10:00.000Z');

    const token = service.issue(
      refreshToken,

      expiresAt,
    );

    expect(token).toBeDefined();

    expect(token).not.toContain(refreshToken);

    expect(() =>
      service.assertValid({
        refreshToken,

        cookieToken: token,

        headerToken: token,
      }),
    ).not.toThrow();
  });

  it('rejects mismatched cookie and header', () => {
    const service = createService();

    const token = service.issue(
      refreshToken,

      new Date('2026-08-03T05:10:00.000Z'),
    );

    let error: AccessDeniedException | undefined;

    try {
      service.assertValid({
        refreshToken,

        cookieToken: token,

        headerToken: `${token}-modified`,
      });
    } catch (e) {
      error = e as AccessDeniedException;
    }

    expect(error).toBeInstanceOf(AccessDeniedException);

    expect(error?.code).toBe('AUTH_CSRF_TOKEN_MISMATCH');
  });

  it('rejects token with another refresh token', () => {
    const service = createService();

    const token = service.issue(
      refreshToken,

      new Date('2026-08-03T05:10:00.000Z'),
    );

    let error: AccessDeniedException | undefined;

    try {
      service.assertValid({
        refreshToken: 'another-refresh-token',

        cookieToken: token,

        headerToken: token,
      });
    } catch (e) {
      error = e as AccessDeniedException;
    }

    expect(error).toBeInstanceOf(AccessDeniedException);

    expect(error?.code).toBe('AUTH_CSRF_TOKEN_INVALID');
  });

  it('rejects an expired token', () => {
    const service = createService();

    const token = service.issue(
      refreshToken,

      new Date('2026-08-03T05:01:00.000Z'),
    );

    jest.setSystemTime(new Date('2026-08-03T05:01:01.000Z'));

    let error: AccessDeniedException | undefined;

    try {
      service.assertValid({
        refreshToken,

        cookieToken: token,

        headerToken: token,
      });
    } catch (e) {
      error = e as AccessDeniedException;
    }

    expect(error).toBeInstanceOf(AccessDeniedException);

    expect(error?.code).toBe('AUTH_CSRF_TOKEN_EXPIRED');
  });

  it('requires both cookie and header', () => {
    const service = createService();

    let error: AccessDeniedException | undefined;

    try {
      service.assertValid({
        refreshToken,

        cookieToken: undefined,

        headerToken: undefined,
      });
    } catch (e) {
      error = e as AccessDeniedException;
    }

    expect(error).toBeInstanceOf(AccessDeniedException);

    expect(error?.code).toBe('AUTH_CSRF_TOKEN_REQUIRED');
  });

  it('rotates token even for the same refresh token', () => {
    const service = createService();

    const expiresAt = new Date('2026-08-03T05:10:00.000Z');

    const first = service.issue(
      refreshToken,

      expiresAt,
    );

    const second = service.issue(
      refreshToken,

      expiresAt,
    );

    expect(first).not.toBe(second);
  });

  it('is a no-op when disabled', () => {
    const service = createService({
      enabled: false,
    });

    expect(
      service.issue(
        refreshToken,

        new Date('2026-08-03T05:10:00.000Z'),
      ),
    ).toBeUndefined();

    expect(() =>
      service.assertValid({
        refreshToken,

        cookieToken: undefined,

        headerToken: undefined,
      }),
    ).not.toThrow();
  });
});

function createService(
  overrides: {
    enabled?: boolean;
  } = {},
): CsrfTokenService {
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

    csrf: {
      enabled: overrides.enabled ?? true,

      secret: 'csrf-secret-with-at-least-32-characters',

      cookieName: 'csrf_token',

      cookiePath: '/',
    },

    loginRateLimit: {
      enabled: false,

      windowSeconds: 900,

      ipLimit: 20,

      identifierLimit: 5,
    },

    jwtBlacklist: {
      enabled: false,

      failureMode: 'closed',
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
      google: { enabled: false },
      github: { enabled: false },
    },

    sessions: {
      maxActiveSessions: 10,

      listLimit: 20,
    },

    audit: {
      historyLimit: 50,
    },
  };

  return new CsrfTokenService({
    getOrThrow: jest.fn().mockReturnValue(authConfig),
  } as never);
}
