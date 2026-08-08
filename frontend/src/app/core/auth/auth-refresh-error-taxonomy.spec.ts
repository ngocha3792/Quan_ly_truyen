import { HttpErrorResponse } from '@angular/common/http';

import { TestBed } from '@angular/core/testing';

import { firstValueFrom, Observable, throwError } from 'rxjs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthApiService } from './auth-api.service';

import { AuthRefreshCoordinatorService } from './auth-refresh-coordinator.service';

import { AuthRefreshService } from './auth-refresh.service';

import { AuthSessionLifecycleService } from './auth-session-lifecycle.service';

import { RefreshTokenResponse } from './auth.models';

import { TokenStore } from './token.store';

describe('AuthRefreshService refresh error taxonomy', () => {
  let service: AuthRefreshService;

  let tokenStore: TokenStore;

  let api: {
    refresh: ReturnType<typeof vi.fn>;
  };

  let lifecycle: {
    invalidateSession: ReturnType<typeof vi.fn>;

    loseAccess: ReturnType<typeof vi.fn>;
  };

  let coordinator: {
    runExclusive: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    api = {
      refresh: vi.fn(),
    };

    lifecycle = {
      invalidateSession: vi.fn(),

      loseAccess: vi.fn(),
    };

    coordinator = {
      /*
       * Test taxonomy, không test Web Locks ở file này.
       *
       * Cho operation chạy trực tiếp để giữ test deterministic.
       */
      runExclusive: vi.fn((operation: () => Observable<RefreshTokenResponse>) => operation()),
    };

    TestBed.configureTestingModule({
      providers: [
        AuthRefreshService,

        TokenStore,

        {
          provide: AuthApiService,

          useValue: api,
        },

        {
          provide: AuthSessionLifecycleService,

          useValue: lifecycle,
        },

        {
          provide: AuthRefreshCoordinatorService,

          useValue: coordinator,
        },
      ],
    });

    service = TestBed.inject(AuthRefreshService);

    tokenStore = TestBed.inject(TokenStore);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it.each(['AUTH_INVALID_REFRESH_TOKEN', 'AUTH_REFRESH_TOKEN_REUSE_DETECTED'])(
    '%s là terminal refresh-session error và phải invalidate session',
    async (code) => {
      tokenStore.set('expired-access-token');

      const error = createRefreshError(
        401,

        code,
      );

      api.refresh.mockReturnValue(throwError(() => error));

      await expect(firstValueFrom(service.refreshAccessToken())).rejects.toBe(error);

      expect(tokenStore.accessToken()).toBeNull();

      expect(lifecycle.invalidateSession).toHaveBeenCalledTimes(1);

      expect(lifecycle.invalidateSession).toHaveBeenCalledWith(
        'refresh-session-rejected',

        true,
      );

      expect(lifecycle.loseAccess).not.toHaveBeenCalled();
    },
  );

  it.each([
    'AUTH_CSRF_TOKEN_REQUIRED',

    'AUTH_CSRF_TOKEN_MALFORMED',

    'AUTH_CSRF_TOKEN_MISMATCH',

    'AUTH_CSRF_TOKEN_EXPIRED',

    'AUTH_CSRF_TOKEN_INVALID',

    'AUTH_CSRF_ORIGIN_REJECTED',
  ])('%s không được bị hiểu là refresh session đã chết', async (code) => {
    tokenStore.set('expired-access-token');

    const error = createRefreshError(
      403,

      code,
    );

    api.refresh.mockReturnValue(throwError(() => error));

    await expect(firstValueFrom(service.refreshAccessToken())).rejects.toBe(error);

    /*
     * Access token vừa bị backend từ chối
     * nên vẫn phải clear.
     */
    expect(tokenStore.accessToken()).toBeNull();

    /*
     * CSRF / Origin failure KHÔNG chứng minh
     * refresh HttpOnly cookie đã hết hạn/revoke.
     *
     * Đây là invariant cần giữ.
     */
    expect(lifecycle.invalidateSession).not.toHaveBeenCalled();

    expect(lifecycle.loseAccess).toHaveBeenCalledTimes(1);

    expect(lifecycle.loseAccess).toHaveBeenCalledWith('refresh-temporarily-unavailable');
  });
});

function createRefreshError(
  status: number,

  code: string,
): HttpErrorResponse {
  return new HttpErrorResponse({
    status,

    statusText: status === 401 ? 'Unauthorized' : 'Forbidden',

    url: '/api/v1/auth/refresh',

    error: {
      success: false,

      error: {
        code,

        message: `Regression test error: ${code}`,

        retryable: false,
      },

      requestId: 'phase-0-refresh-taxonomy',

      timestamp: '2026-08-08T00:00:00.000Z',

      path: '/api/v1/auth/refresh',
    },
  });
}
