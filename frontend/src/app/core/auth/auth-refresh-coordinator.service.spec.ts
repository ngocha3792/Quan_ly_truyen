import { firstValueFrom, of, Subject } from 'rxjs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthRefreshCoordinatorService } from './auth-refresh-coordinator.service';

describe('AuthRefreshCoordinatorService', () => {
  let originalLocksDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalLocksDescriptor = Object.getOwnPropertyDescriptor(
      navigator,

      'locks',
    );
  });

  afterEach(() => {
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
  });

  it('không biến operation thành Promise/microtask khi browser không có Web Locks', () => {
    setLocks(undefined);

    const service = new AuthRefreshCoordinatorService();

    const subject = new Subject<string>();

    let started = 0;

    const received: string[] = [];

    service
      .runExclusive(() => {
        started += 1;

        return subject.asObservable();
      })
      .subscribe((value) => {
        received.push(value);
      });

    /*
     * Regression test cho lỗi Stage 2:
     * operation phải subscribe ngay.
     */
    expect(started).toBe(1);

    subject.next('access-v2');

    subject.complete();

    expect(received).toEqual(['access-v2']);
  });

  it('serialize refresh giữa hai browser contexts bằng cùng Web Lock', async () => {
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

    const tabA = new AuthRefreshCoordinatorService();

    const tabB = new AuthRefreshCoordinatorService();

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

    /*
     * Tab B chưa được chạy khi A
     * vẫn giữ refresh lock.
     */
    expect(started).toEqual(['A']);

    firstRefresh.next('token-A');

    firstRefresh.complete();

    await expect(first).resolves.toBe('token-A');

    await expect(second).resolves.toBe('token-B');

    expect(started).toEqual(['A', 'B']);

    expect(request).toHaveBeenCalledTimes(2);
  });

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

  async function flushMicrotasks(): Promise<void> {
    await Promise.resolve();

    await Promise.resolve();

    await Promise.resolve();
  }
});
