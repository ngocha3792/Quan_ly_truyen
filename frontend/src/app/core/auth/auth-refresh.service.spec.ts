import { HttpErrorResponse } from '@angular/common/http';

import { TestBed } from '@angular/core/testing';

import { firstValueFrom, Observable, of, Subject, throwError } from 'rxjs';

import { AuthApiService } from './auth-api.service';

import { AuthRefreshCoordinatorService } from './auth-refresh-coordinator.service';

import { AuthRefreshService } from './auth-refresh.service';

import { AuthSessionLifecycleService } from './auth-session-lifecycle.service';

import { RefreshTokenResponse } from './auth.models';

import { TokenStore } from './token.store';

import { createRefreshResponse } from './testing/auth-test.fixtures';

describe('AuthRefreshService', () => {
  let service: AuthRefreshService;

  let tokenStore: TokenStore;

  let lifecycle: AuthSessionLifecycleService;

  let api: {
    refresh: ReturnType<typeof vi.fn>;
  };

  let coordinator: {
    runExclusive: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    api = {
      refresh: vi.fn(),
    };

    coordinator = {
      /**
       * AuthRefreshService.spec test
       * same-tab single-flight.
       *
       * Cross-tab serialization được test riêng
       * trong AuthRefreshCoordinatorService.spec.
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
          provide: AuthRefreshCoordinatorService,

          useValue: coordinator,
        },
      ],
    });

    service = TestBed.inject(AuthRefreshService);

    tokenStore = TestBed.inject(TokenStore);

    lifecycle = TestBed.inject(AuthSessionLifecycleService);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('chỉ gọi refresh một lần khi nhiều caller đồng thời', () => {
    const subject = new Subject<RefreshTokenResponse>();

    api.refresh.mockReturnValue(subject.asObservable());

    const received: string[] = [];

    service.refreshAccessToken().subscribe((token) => {
      received.push(token);
    });

    service.refreshAccessToken().subscribe((token) => {
      received.push(token);
    });

    service.refreshAccessToken().subscribe((token) => {
      received.push(token);
    });

    service.refreshAccessToken().subscribe((token) => {
      received.push(token);
    });

    service.refreshAccessToken().subscribe((token) => {
      received.push(token);
    });

    expect(coordinator.runExclusive).toHaveBeenCalledTimes(1);

    expect(api.refresh).toHaveBeenCalledTimes(1);

    subject.next(createRefreshResponse('access-token-v2'));

    subject.complete();

    expect(received).toEqual([
      'access-token-v2',

      'access-token-v2',

      'access-token-v2',

      'access-token-v2',

      'access-token-v2',
    ]);

    expect(tokenStore.accessToken()).toBe('access-token-v2');
  });

  it('cho phép refresh mới sau khi request trước hoàn tất', async () => {
    api.refresh.mockReturnValueOnce(of(createRefreshResponse('access-token-v2')));

    const first = await firstValueFrom(service.refreshAccessToken());

    expect(first).toBe('access-token-v2');

    api.refresh.mockReturnValueOnce(of(createRefreshResponse('access-token-v3')));

    const second = await firstValueFrom(service.refreshAccessToken());

    expect(second).toBe('access-token-v3');

    expect(coordinator.runExclusive).toHaveBeenCalledTimes(2);

    expect(api.refresh).toHaveBeenCalledTimes(2);

    expect(tokenStore.accessToken()).toBe('access-token-v3');
  });

  it('xóa access token nếu refresh thất bại', async () => {
    tokenStore.set('expired-access-token');

    api.refresh.mockReturnValue(throwError(() => new Error('refresh failed')));

    await expect(firstValueFrom(service.refreshAccessToken())).rejects.toThrow('refresh failed');

    expect(tokenStore.accessToken()).toBeNull();
  });

  it('reset single-flight state sau khi refresh fail', async () => {
    api.refresh.mockReturnValueOnce(throwError(() => new Error('refresh failed')));

    await expect(firstValueFrom(service.refreshAccessToken())).rejects.toThrow();

    api.refresh.mockReturnValueOnce(of(createRefreshResponse('access-token-new')));

    const token = await firstValueFrom(service.refreshAccessToken());

    expect(token).toBe('access-token-new');

    expect(coordinator.runExclusive).toHaveBeenCalledTimes(2);

    expect(api.refresh).toHaveBeenCalledTimes(2);
  });

  it('invalidate toàn bộ session khi refresh token bị backend từ chối', async () => {
    tokenStore.set('expired-access-token');

    const events: string[] = [];

    lifecycle.changes$.subscribe((event) => {
      events.push(event.kind);
    });

    api.refresh.mockReturnValue(
      throwError(() =>
        createApiError(
          401,

          'AUTH_INVALID_REFRESH_TOKEN',
        ),
      ),
    );

    await expect(firstValueFrom(service.refreshAccessToken())).rejects.toBeInstanceOf(
      HttpErrorResponse,
    );

    expect(tokenStore.accessToken()).toBeNull();

    expect(events).toContain('session-invalidated');

    expect(events).not.toContain('access-lost');
  });

  it('refresh token reuse phải invalidate toàn bộ session', async () => {
    tokenStore.set('expired-access-token');

    const events: string[] = [];

    lifecycle.changes$.subscribe((event) => {
      events.push(event.kind);
    });

    api.refresh.mockReturnValue(
      throwError(() =>
        createApiError(
          401,

          'AUTH_REFRESH_TOKEN_REUSE_DETECTED',
        ),
      ),
    );

    await expect(firstValueFrom(service.refreshAccessToken())).rejects.toBeInstanceOf(
      HttpErrorResponse,
    );

    expect(events).toContain('session-invalidated');

    expect(events).not.toContain('access-lost');
  });

  it('network/5xx chỉ đánh dấu access lost chứ không invalidate refresh session', async () => {
    tokenStore.set('expired-access-token');

    const events: string[] = [];

    lifecycle.changes$.subscribe((event) => {
      events.push(event.kind);
    });

    api.refresh.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 503,

            statusText: 'Service Unavailable',
          }),
      ),
    );

    await expect(firstValueFrom(service.refreshAccessToken())).rejects.toBeInstanceOf(
      HttpErrorResponse,
    );

    expect(events).toContain('access-lost');

    expect(events).not.toContain('session-invalidated');
  });

  it('401 không có terminal error code không được tự động invalidate refresh session', async () => {
    tokenStore.set('expired-access-token');

    const events: string[] = [];

    lifecycle.changes$.subscribe((event) => {
      events.push(event.kind);
    });

    api.refresh.mockReturnValue(
      throwError(() =>
        createApiError(
          401,

          'UNKNOWN_AUTH_ERROR',
        ),
      ),
    );

    await expect(firstValueFrom(service.refreshAccessToken())).rejects.toBeInstanceOf(
      HttpErrorResponse,
    );

    expect(events).toContain('access-lost');

    expect(events).not.toContain('session-invalidated');
  });
});

function createApiError(
  status: number,

  code: string,
): HttpErrorResponse {
  return new HttpErrorResponse({
    status,

    statusText: status === 401 ? 'Unauthorized' : 'Error',

    url: '/api/v1/auth/refresh',

    error: {
      success: false,

      error: {
        code,

        message: `Test error: ${code}`,

        retryable: false,
      },

      requestId: 'auth-refresh-service-spec',

      timestamp: '2026-08-08T00:00:00.000Z',

      path: '/api/v1/auth/refresh',
    },
  });
}
