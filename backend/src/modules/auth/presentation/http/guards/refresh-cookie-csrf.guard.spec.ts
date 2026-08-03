import { CSRF_HEADER_NAME } from '@/common/constants';

import { AccessDeniedException } from '@/common/exceptions';

import type { AuthConfig, CorsConfig } from '@/config';

import { RefreshCookieCsrfGuard } from './refresh-cookie-csrf.guard';

describe('RefreshCookieCsrfGuard', () => {
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
      enabled: true,

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

    sessions: {
      maxActiveSessions: 10,

      listLimit: 20,
    },

    audit: {
      historyLimit: 50,
    },
  };

  const corsConfig: CorsConfig = {
    allowedOrigins: ['http://localhost:4200'],

    credentials: true,

    maxAgeSeconds: 86_400,
  };

  let csrfTokenService: {
    isEnabled: jest.Mock;

    assertValid: jest.Mock;
  };

  let guard: RefreshCookieCsrfGuard;

  beforeEach(() => {
    csrfTokenService = {
      isEnabled: jest.fn().mockReturnValue(true),

      assertValid: jest.fn(),
    };

    guard = new RefreshCookieCsrfGuard(
      {
        getOrThrow: jest.fn().mockImplementation((key: string) => {
          if (key === 'auth') {
            return authConfig;
          }

          if (key === 'cors') {
            return corsConfig;
          }

          throw new Error(`Unknown config: ${key}`);
        }),
      } as never,

      csrfTokenService as never,
    );
  });

  it('validates cookie and header', () => {
    const context = createContext({
      cookie: 'refresh_token=refresh-value; csrf_token=csrf-value',

      origin: 'http://localhost:4200',

      [CSRF_HEADER_NAME]: 'csrf-value',
    });

    expect(guard.canActivate(context)).toBe(true);

    expect(csrfTokenService.assertValid).toHaveBeenCalledWith({
      refreshToken: 'refresh-value',

      cookieToken: 'csrf-value',

      headerToken: 'csrf-value',
    });
  });

  it('allows idempotent logout without refresh cookie', () => {
    const context = createContext({
      origin: 'https://evil.example',
    });

    expect(guard.canActivate(context)).toBe(true);

    expect(csrfTokenService.assertValid).not.toHaveBeenCalled();
  });

  it('rejects an origin outside the CORS allowlist', () => {
    const context = createContext({
      cookie: 'refresh_token=refresh-value; csrf_token=csrf-value',

      origin: 'https://evil.example',

      [CSRF_HEADER_NAME]: 'csrf-value',
    });

    let error: AccessDeniedException | undefined;

    try {
      guard.canActivate(context);
    } catch (e) {
      error = e as AccessDeniedException;
    }

    expect(error).toBeInstanceOf(AccessDeniedException);

    expect(error?.code).toBe('AUTH_CSRF_ORIGIN_REJECTED');

    expect(csrfTokenService.assertValid).not.toHaveBeenCalled();
  });

  it('rejects duplicate refresh cookies', () => {
    const context = createContext({
      cookie:
        'refresh_token=first; refresh_token=second; csrf_token=csrf-value',

      origin: 'http://localhost:4200',

      [CSRF_HEADER_NAME]: 'csrf-value',
    });

    expect(guard.canActivate(context)).toBe(true);

    /*
     * Duplicate refresh cookie được xem
     * như không có credential.
     * Controller sẽ reject refresh token.
     */
    expect(csrfTokenService.assertValid).not.toHaveBeenCalled();
  });
});

function createContext(headers: Readonly<Record<string, string | undefined>>) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers,
      }),
    }),
  } as never;
}
