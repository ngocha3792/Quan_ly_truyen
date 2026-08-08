import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';

import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { TestBed } from '@angular/core/testing';

import { firstValueFrom, forkJoin } from 'rxjs';

import { TokenStore } from '../auth/token.store';

import { AppRuntimeConfig, APP_RUNTIME_CONFIG } from '../config/app-config.token';

import { ApiSuccessEnvelope } from './api-envelope.model';

import { apiInterceptor } from './api.interceptor';

describe('apiInterceptor', () => {
  let http: HttpClient;

  let httpTesting: HttpTestingController;

  let tokenStore: TokenStore;

  const config: AppRuntimeConfig = {
    apiBaseUrl: '/api/v1',

    appName: 'TruyenHub',

    production: false,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiInterceptor])),

        provideHttpClientTesting(),

        {
          provide: APP_RUNTIME_CONFIG,

          useValue: config,
        },
      ],
    });

    http = TestBed.inject(HttpClient);

    httpTesting = TestBed.inject(HttpTestingController);

    tokenStore = TestBed.inject(TokenStore);
  });

  afterEach(() => {
    httpTesting.verify();

    TestBed.resetTestingModule();
  });

  it('gắn bearer token vào API request', () => {
    tokenStore.set('access-token-v1');

    http.get('/api/v1/private').subscribe();

    const request = httpTesting.expectOne('/api/v1/private');

    expect(request.request.headers.get('Authorization')).toBe('Bearer access-token-v1');

    expect(request.request.withCredentials).toBe(true);

    request.flush({
      ok: true,
    });
  });

  it('chỉ gọi refresh một lần khi 5 request cùng trả 401', async () => {
    tokenStore.set('access-token-v1');

    const resultPromise = firstValueFrom(
      forkJoin([
        http.get('/api/v1/private/a'),

        http.get('/api/v1/private/b'),

        http.get('/api/v1/private/c'),

        http.get('/api/v1/private/d'),

        http.get('/api/v1/private/e'),
      ]),
    );

    const originals = httpTesting.match((request) => request.url.startsWith('/api/v1/private/'));

    expect(originals).toHaveLength(5);

    for (const request of originals) {
      expect(request.request.headers.get('Authorization')).toBe('Bearer access-token-v1');

      request.flush(
        unauthorizedBody(),

        {
          status: 401,

          statusText: 'Unauthorized',
        },
      );
    }

    const refreshRequests = httpTesting.match('/api/v1/auth/refresh');

    expect(refreshRequests).toHaveLength(1);

    expect(refreshRequests[0].request.method).toBe('POST');

    refreshRequests[0].flush(
      successEnvelope({
        sessionId: 'session-1',

        accessToken: 'access-token-v2',

        tokenType: 'Bearer' as const,

        expiresIn: 900,

        expiresAt: '2026-08-07T13:00:00.000Z',
      }),
    );

    const retries = httpTesting.match((request) => request.url.startsWith('/api/v1/private/'));

    expect(retries).toHaveLength(5);

    for (const request of retries) {
      expect(request.request.headers.get('Authorization')).toBe('Bearer access-token-v2');

      request.flush({
        ok: true,
      });
    }

    await resultPromise;

    expect(tokenStore.accessToken()).toBe('access-token-v2');
  });

  it('không refresh lần hai cho late 401 của access token cũ', async () => {
    tokenStore.set('access-token-v1');

    const resultPromise = firstValueFrom(
      forkJoin([http.get('/api/v1/private/a'), http.get('/api/v1/private/b')]),
    );

    const originals = httpTesting.match((request) => request.url.startsWith('/api/v1/private/'));

    expect(originals).toHaveLength(2);

    originals[0].flush(
      unauthorizedBody(),

      {
        status: 401,

        statusText: 'Unauthorized',
      },
    );

    const refresh = httpTesting.expectOne('/api/v1/auth/refresh');

    refresh.flush(
      successEnvelope({
        sessionId: 'session-1',

        accessToken: 'access-token-v2',

        tokenType: 'Bearer' as const,

        expiresIn: 900,

        expiresAt: '2026-08-07T13:00:00.000Z',
      }),
    );

    expect(tokenStore.accessToken()).toBe('access-token-v2');

    /*
     * Bây giờ request B mới trả 401.
     *
     * Request B dùng V1,
     * nhưng TokenStore đã là V2.
     */
    originals[1].flush(
      unauthorizedBody(),

      {
        status: 401,

        statusText: 'Unauthorized',
      },
    );

    expect(httpTesting.match('/api/v1/auth/refresh')).toHaveLength(0);

    const retries = httpTesting.match((request) => request.url.startsWith('/api/v1/private/'));

    expect(retries).toHaveLength(2);

    for (const request of retries) {
      expect(request.request.headers.get('Authorization')).toBe('Bearer access-token-v2');

      request.flush({
        ok: true,
      });
    }

    await resultPromise;
  });

  it('không refresh request anonymous không có access token', () => {
    tokenStore.clear();

    let failed = false;

    http.get('/api/v1/private').subscribe({
      error: () => {
        failed = true;
      },
    });

    const request = httpTesting.expectOne('/api/v1/private');

    request.flush(
      unauthorizedBody(),

      {
        status: 401,

        statusText: 'Unauthorized',
      },
    );

    expect(failed).toBe(true);

    httpTesting.expectNone('/api/v1/auth/refresh');
  });

  it('không gắn access token vào third-party request', () => {
    tokenStore.set('access-token-v1');

    http.get('https://example.com/data').subscribe();

    const request = httpTesting.expectOne('https://example.com/data');

    expect(request.request.headers.has('Authorization')).toBe(false);

    expect(request.request.withCredentials).toBe(false);

    request.flush({
      ok: true,
    });
  });
});

function successEnvelope<T>(data: T): ApiSuccessEnvelope<T> {
  return {
    success: true,

    data,

    requestId: 'request-test',

    timestamp: '2026-08-07T12:00:00.000Z',
  };
}

function unauthorizedBody() {
  return {
    success: false,

    error: {
      code: 'AUTH_ACCESS_TOKEN_INVALID',

      message: 'Access token đã hết hạn.',

      retryable: false,
    },

    requestId: 'request-test',

    timestamp: '2026-08-07T12:00:00.000Z',

    path: '/api/v1/private',
  };
}
