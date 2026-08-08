import { HttpErrorResponse } from '@angular/common/http';

import { TestBed } from '@angular/core/testing';

import { catchError, firstValueFrom, map, of, throwError, timeout, TimeoutError } from 'rxjs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthApiService } from './auth-api.service';

import { resolveAuthenticatedUser } from './auth-guard.util';

import { AuthRefreshService } from './auth-refresh.service';

import { AuthSessionHintStore } from './auth-session-hint.store';

import { AuthStore } from './auth.store';

import { TokenStore } from './token.store';

describe('Auth guard bootstrap regression', () => {
  let auth: AuthStore;

  let refreshService: {
    refreshAccessToken: ReturnType<typeof vi.fn>;
  };

  let sessionHint: {
    shouldAttemptRefresh: ReturnType<typeof vi.fn>;

    markSessionPresent: ReturnType<typeof vi.fn>;

    markSessionAbsent: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
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

          useValue: {
            me: vi.fn(),
          },
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

    auth = TestBed.inject(AuthStore);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('không được treo vô hạn khi bootstrap gặp lỗi tạm thời', async () => {
    sessionHint.shouldAttemptRefresh.mockReturnValue(true);

    refreshService.refreshAccessToken.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 503,

            statusText: 'Service Unavailable',
          }),
      ),
    );

    const result$ = TestBed.runInInjectionContext(() => resolveAuthenticatedUser(auth));

    const outcome = await firstValueFrom(
      result$.pipe(
        map((user) => ({
          kind: 'resolved' as const,

          user,
        })),

        timeout({
          first: 100,
        }),

        catchError((error: unknown) => {
          if (error instanceof TimeoutError) {
            return of({
              kind: 'timed-out' as const,

              user: null,
            });
          }

          return of({
            kind: 'errored' as const,

            user: null,
          });
        }),
      ),
    );

    expect(outcome.kind).toBe('resolved');

    expect(outcome.user).toBeNull();

    /**
     * Network/5xx vẫn recoverable.
     */
    expect(auth.status()).toBe('idle');

    expect(sessionHint.markSessionAbsent).not.toHaveBeenCalled();
  });
});
