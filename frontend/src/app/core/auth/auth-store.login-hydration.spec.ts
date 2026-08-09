import { HttpErrorResponse } from '@angular/common/http';

import { TestBed } from '@angular/core/testing';

import { firstValueFrom, of, throwError } from 'rxjs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthApiService } from './auth-api.service';

import { AuthRefreshService } from './auth-refresh.service';

import { AuthSessionHintStore } from './auth-session-hint.store';

import { AuthStore } from './auth.store';

import { TokenStore } from './token.store';

import { createCurrentUser, createLoginResponse } from './testing/auth-test.fixtures';

describe('AuthStore login hydration regression', () => {
  let store: AuthStore;

  let tokens: TokenStore;

  let api: {
    login: ReturnType<typeof vi.fn>;

    register: ReturnType<typeof vi.fn>;

    me: ReturnType<typeof vi.fn>;

    logout: ReturnType<typeof vi.fn>;

    beginMfaEnrollment: ReturnType<typeof vi.fn>;

    confirmMfaEnrollment: ReturnType<typeof vi.fn>;

    verifyMfa: ReturnType<typeof vi.fn>;
  };

  let refreshService: {
    refreshAccessToken: ReturnType<typeof vi.fn>;
  };

  let sessionHint: {
    shouldAttemptRefresh: ReturnType<typeof vi.fn>;

    markSessionPresent: ReturnType<typeof vi.fn>;

    markSessionAbsent: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    api = {
      login: vi.fn(),

      register: vi.fn(),

      me: vi.fn(),

      logout: vi.fn(),

      beginMfaEnrollment: vi.fn(),

      confirmMfaEnrollment: vi.fn(),

      verifyMfa: vi.fn(),
    };

    refreshService = {
      refreshAccessToken: vi.fn(),
    };

    sessionHint = {
      shouldAttemptRefresh: vi.fn(),

      markSessionPresent: vi.fn(),

      markSessionAbsent: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        AuthStore,

        TokenStore,

        {
          provide: AuthApiService,

          useValue: api,
        },

        {
          provide: AuthRefreshService,

          useValue: refreshService,
        },

        {
          provide: AuthSessionHintStore,

          useValue: sessionHint,
        },
      ],
    });

    store = TestBed.inject(AuthStore);

    tokens = TestBed.inject(TokenStore);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it.each([
    {
      label: 'network error',

      status: 0,

      statusText: 'Unknown Error',
    },
    {
      label: '503',

      status: 503,

      statusText: 'Service Unavailable',
    },
  ])(
    'login 200 nhưng /me gặp $label phải giữ refresh-session hint',
    async ({ status, statusText }) => {
      const user = createCurrentUser();

      const error = new HttpErrorResponse({
        status,

        statusText,

        url: '/api/v1/auth/me',
      });

      api.login.mockReturnValue(of(createLoginResponse('login-access-token', user)));

      api.me.mockReturnValue(throwError(() => error));

      await expect(
        firstValueFrom(
          store.login({
            identifier: user.email,

            password: 'Password@123',
          }),
        ),
      ).rejects.toBe(error);

      /*
       * Chưa hydrate được identity nên không được
       * coi user là authenticated.
       */
      expect(store.status()).toBe('idle');

      expect(store.user()).toBeNull();

      expect(store.isAuthenticated()).toBe(false);

      /*
       * Access token hiện tại không còn được tin tưởng
       * sau khi bước hydrate thất bại.
       */
      expect(tokens.accessToken()).toBeNull();

      /*
       * Nhưng login đã 200 nên refresh session
       * có thể vẫn tồn tại phía browser/backend.
       */
      expect(sessionHint.markSessionPresent).toHaveBeenCalled();

      /*
       * Invariant quan trọng nhất của Phase 2.
       */
      expect(sessionHint.markSessionAbsent).not.toHaveBeenCalled();
    },
  );

  it('sau login 200 + /me lỗi tạm thời, bootstrap phải refresh và hydrate lại được', async () => {
    const user = createCurrentUser({
      displayName: 'Recovered User',
    });

    const transientError = new HttpErrorResponse({
      status: 503,

      statusText: 'Service Unavailable',

      url: '/api/v1/auth/me',
    });

    api.login.mockReturnValue(of(createLoginResponse('login-access-token', user)));

    /*
     * /me đầu tiên chạy sau login và fail.
     *
     * /me thứ hai chạy sau refresh bootstrap
     * và thành công.
     */
    api.me.mockReturnValueOnce(throwError(() => transientError)).mockReturnValueOnce(of(user));

    sessionHint.shouldAttemptRefresh.mockReturnValue(true);

    refreshService.refreshAccessToken.mockImplementation(() => {
      tokens.set('access-token-after-refresh');

      return of('access-token-after-refresh');
    });

    await expect(
      firstValueFrom(
        store.login({
          identifier: user.email,

          password: 'Password@123',
        }),
      ),
    ).rejects.toBe(transientError);

    expect(store.status()).toBe('idle');

    /*
     * Đây mô phỏng lần bootstrap tiếp theo:
     *
     * reload page
     * hoặc route guard retry auth initialization.
     */
    const bootstrapResult = await firstValueFrom(store.ensureInitialized());

    expect(bootstrapResult).toBe('authenticated');

    expect(refreshService.refreshAccessToken).toHaveBeenCalledTimes(1);

    expect(api.me).toHaveBeenCalledTimes(2);

    expect(store.status()).toBe('authenticated');

    expect(store.user()).toEqual(user);

    expect(tokens.accessToken()).toBe('access-token-after-refresh');

    expect(sessionHint.markSessionAbsent).not.toHaveBeenCalled();
  });

  it('login 200 nhưng /me trả terminal session error phải clear session', async () => {
    const user = createCurrentUser();

    const error = createCurrentUserError('AUTHENTICATION_REQUIRED');

    api.login.mockReturnValue(of(createLoginResponse('login-access-token', user)));

    api.me.mockReturnValue(throwError(() => error));

    await expect(
      firstValueFrom(
        store.login({
          identifier: user.email,

          password: 'Password@123',
        }),
      ),
    ).rejects.toBe(error);

    /*
     * Terminal error chứng minh session
     * không usable nữa.
     */
    expect(store.status()).toBe('anonymous');

    expect(store.user()).toBeNull();

    expect(store.isAuthenticated()).toBe(false);

    expect(tokens.accessToken()).toBeNull();

    expect(sessionHint.markSessionAbsent).toHaveBeenCalled();
  });
});

function createCurrentUserError(code: string): HttpErrorResponse {
  return new HttpErrorResponse({
    status: 401,

    statusText: 'Unauthorized',

    url: '/api/v1/auth/me',

    error: {
      success: false,

      error: {
        code,

        message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn',

        retryable: false,
      },

      requestId: 'phase-2-login-hydration',

      timestamp: '2026-08-09T00:00:00.000Z',

      path: '/api/v1/auth/me',
    },
  });
}
