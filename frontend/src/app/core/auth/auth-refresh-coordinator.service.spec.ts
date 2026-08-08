import { firstValueFrom, of, Subject } from 'rxjs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthRefreshCoordinatorService } from './auth-refresh-coordinator.service';

const LEASE_STORAGE_KEY = 'truyenhub.auth.refresh-token-rotation.lease.v1';

describe('AuthRefreshCoordinatorService', () => {
  let originalLocksDescriptor: PropertyDescriptor | undefined;

  let originalLeaseValue: string | null;

  const services: AuthRefreshCoordinatorService[] = [];

  beforeEach(() => {
    originalLocksDescriptor = Object.getOwnPropertyDescriptor(
      navigator,

      'locks',
    );

    originalLeaseValue = window.localStorage.getItem(LEASE_STORAGE_KEY);

    window.localStorage.removeItem(LEASE_STORAGE_KEY);

    /**
     * Các fallback test bên dưới cố ý chạy
     * KHÔNG có BroadcastChannel.
     *
     * Như vậy correctness được chứng minh
     * dựa trên localStorage lease.
     *
     * BroadcastChannel trong production chỉ
     * giúp wake waiter nhanh hơn.
     */
    vi.stubGlobal(
      'BroadcastChannel',

      undefined,
    );

    /**
     * Làm contention deterministic:
     * tab A được schedule claim trước tab B.
     */
    vi.spyOn(
      Math,

      'random',
    ).mockReturnValue(0);
  });

  afterEach(() => {
    for (const service of services) {
      service.ngOnDestroy();
    }

    services.length = 0;

    if (originalLeaseValue === null) {
      window.localStorage.removeItem(LEASE_STORAGE_KEY);
    } else {
      window.localStorage.setItem(
        LEASE_STORAGE_KEY,

        originalLeaseValue,
      );
    }

    if (originalLocksDescriptor) {
      Object.defineProperty(
        navigator,

        'locks',

        originalLocksDescriptor,
      );
    } else {
      Reflect.deleteProperty(
        navigator,

        'locks',
      );
    }

    vi.restoreAllMocks();

    vi.unstubAllGlobals();
  });

  it('serialize refresh bằng native Web Locks khi browser hỗ trợ', async () => {
    let tail = Promise.resolve();

    const request = vi.fn(
      <T>(
        _name: string,

        _options: unknown,

        callback: () => T | Promise<T>,
      ): Promise<T> => {
        const result = tail.then(() => callback());

        tail = result.then(
          () => undefined,

          () => undefined,
        );

        return result;
      },
    );

    setLocks({
      request,
    });

    const tabA = createService();

    const tabB = createService();

    const firstRefresh = new Subject<string>();

    const started: string[] = [];

    const first = firstValueFrom(
      tabA.runExclusive(() => {
        started.push('A');

        return firstRefresh.asObservable();
      }),
    );

    const second = firstValueFrom(
      tabB.runExclusive(() => {
        started.push('B');

        return of('token-B');
      }),
    );

    await flushMicrotasks();

    expect(started).toEqual(['A']);

    firstRefresh.next('token-A');

    firstRefresh.complete();

    await expect(first).resolves.toBe('token-A');

    await expect(second).resolves.toBe('token-B');

    expect(started).toEqual(['A', 'B']);

    expect(request).toHaveBeenCalledTimes(2);
  });

  it('serialize hai tab bằng localStorage lease khi không có Web Locks', async () => {
    setLocks(undefined);

    const tabA = createService();

    const tabB = createService();

    const firstRefresh = new Subject<string>();

    const started: string[] = [];

    const first = firstValueFrom(
      tabA.runExclusive(() => {
        started.push('A');

        return firstRefresh.asObservable();
      }),
    );

    const second = firstValueFrom(
      tabB.runExclusive(() => {
        started.push('B');

        return of('token-B');
      }),
    );

    /**
     * Chờ tab A acquire fallback lease.
     */
    await waitUntil(() => started.length === 1);

    expect(started).toEqual(['A']);

    /**
     * Tab B tuyệt đối chưa được tạo HTTP request
     * khi A vẫn đang giữ lease.
     */
    await sleep(40);

    expect(started).toEqual(['A']);

    firstRefresh.next('token-A');

    firstRefresh.complete();

    await expect(first).resolves.toBe('token-A');

    await expect(second).resolves.toBe('token-B');

    expect(started).toEqual(['A', 'B']);

    /**
     * Lease phải được release sau operation cuối.
     */
    expect(window.localStorage.getItem(LEASE_STORAGE_KEY)).toBeNull();
  });

  it('release fallback lease khi refresh operation fail để tab khác tiếp tục', async () => {
    setLocks(undefined);

    const tabA = createService();

    const tabB = createService();

    const firstRefresh = new Subject<string>();

    const started: string[] = [];

    const first = firstValueFrom(
      tabA.runExclusive(() => {
        started.push('A');

        return firstRefresh.asObservable();
      }),
    );

    await waitUntil(() => started.length === 1);

    const second = firstValueFrom(
      tabB.runExclusive(() => {
        started.push('B');

        return of('token-B');
      }),
    );

    await sleep(40);

    expect(started).toEqual(['A']);

    const failure = new Error('refresh A failed');

    firstRefresh.error(failure);

    await expect(first).rejects.toBe(failure);

    /**
     * finally phải release lease của A,
     * nên B cuối cùng được chạy.
     */
    await expect(second).resolves.toBe('token-B');

    expect(started).toEqual(['A', 'B']);

    expect(window.localStorage.getItem(LEASE_STORAGE_KEY)).toBeNull();
  });

  it('recovery được lease của tab đã chết khi lease hết hạn', async () => {
    setLocks(undefined);

    window.localStorage.setItem(
      LEASE_STORAGE_KEY,

      JSON.stringify({
        ownerId: 'dead-tab',

        leaseId: 'dead-lease',

        expiresAt: Date.now() - 10_000,
      }),
    );

    const service = createService();

    const started: string[] = [];

    const result = await firstValueFrom(
      service.runExclusive(() => {
        started.push('current-tab');

        return of('access-v2');
      }),
    );

    expect(result).toBe('access-v2');

    expect(started).toEqual(['current-tab']);

    expect(window.localStorage.getItem(LEASE_STORAGE_KEY)).toBeNull();
  });

  it('không chạy operation của tab B trong lúc lease sống của tab A còn tồn tại', async () => {
    setLocks(undefined);

    window.localStorage.setItem(
      LEASE_STORAGE_KEY,

      JSON.stringify({
        ownerId: 'another-live-tab',

        leaseId: 'live-lease',

        expiresAt: Date.now() + 300,
      }),
    );

    const service = createService();

    let started = false;

    const resultPromise = firstValueFrom(
      service.runExclusive(() => {
        started = true;

        return of('access-after-expiry');
      }),
    );

    await sleep(80);

    /**
     * Lease kia vẫn còn sống.
     */
    expect(started).toBe(false);

    await expect(resultPromise).resolves.toBe('access-after-expiry');

    expect(started).toBe(true);
  });

  function createService(): AuthRefreshCoordinatorService {
    const service = new AuthRefreshCoordinatorService();

    services.push(service);

    return service;
  }

  function setLocks(value: unknown): void {
    Object.defineProperty(
      navigator,

      'locks',

      {
        configurable: true,

        value,
      },
    );
  }
});

async function waitUntil(
  predicate: () => boolean,

  timeoutMs = 1_000,
): Promise<void> {
  const startedAt = Date.now();

  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error('Timed out waiting for condition');
    }

    await sleep(5);
  }
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(
      resolve,

      milliseconds,
    );
  });
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();

  await Promise.resolve();

  await Promise.resolve();
}
