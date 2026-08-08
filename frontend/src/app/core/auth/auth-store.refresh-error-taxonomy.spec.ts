import { HttpErrorResponse } from '@angular/common/http';

import { TestBed } from '@angular/core/testing';

import { throwError } from 'rxjs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthApiService } from './auth-api.service';

import { AuthRefreshService } from './auth-refresh.service';

import { AuthSessionHintStore } from './auth-session-hint.store';

import { AuthStore } from './auth.store';

import { TokenStore } from './token.store';

describe('AuthStore refresh error taxonomy regression', () => {
  let store: AuthStore;

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
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it.each(['AUTH_CSRF_TOKEN_MISMATCH', 'AUTH_CSRF_ORIGIN_REJECTED'])(
    'bootstrap gặp %s phải giữ session hint và cho phép retry',
    (code) => {
      sessionHint.shouldAttemptRefresh.mockReturnValue(true);

      refreshService.refreshAccessToken.mockReturnValue(
        throwError(() =>
          createRefreshError(
            403,

            code,
          ),
        ),
      );

      store.initialize();

      /*
       * CSRF/origin failure không chứng minh
       * refresh cookie đã chết.
       *
       * AuthStore phải quay về recoverable state
       * để lần sau còn bootstrap lại được.
       */
      expect(store.status()).toBe('idle');

      expect(store.user()).toBeNull();

      expect(sessionHint.markSessionPresent).toHaveBeenCalled();

      /*
       * Tuyệt đối không đánh dấu refresh session absent.
       */
      expect(sessionHint.markSessionAbsent).not.toHaveBeenCalled();
    },
  );
});

function createRefreshError(
  status: number,

  code: string,
): HttpErrorResponse {
  return new HttpErrorResponse({
    status,

    statusText: 'Forbidden',

    url: '/api/v1/auth/refresh',

    error: {
      success: false,

      error: {
        code,

        message: `Regression test error: ${code}`,

        retryable: false,
      },

      requestId: 'phase-0-auth-store-taxonomy',

      timestamp: '2026-08-08T00:00:00.000Z',

      path: '/api/v1/auth/refresh',
    },
  });
}
