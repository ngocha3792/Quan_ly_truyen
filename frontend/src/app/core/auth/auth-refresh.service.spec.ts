import { TestBed } from '@angular/core/testing';

import { firstValueFrom, of, Subject, throwError } from 'rxjs';

import { AuthApiService } from './auth-api.service';

import { AuthRefreshService } from './auth-refresh.service';

import { RefreshTokenResponse } from './auth.models';

import { TokenStore } from './token.store';

import { createRefreshResponse } from './testing/auth-test.fixtures';

describe('AuthRefreshService', () => {
  let service: AuthRefreshService;

  let tokenStore: TokenStore;

  let api: {
    refresh: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    api = {
      refresh: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        AuthRefreshService,

        TokenStore,

        {
          provide: AuthApiService,

          useValue: api,
        },
      ],
    });

    service = TestBed.inject(AuthRefreshService);

    tokenStore = TestBed.inject(TokenStore);
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

    expect(api.refresh).toHaveBeenCalledTimes(2);
  });
});
