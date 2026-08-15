/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { ConcurrencyConflictException } from '@/common/exceptions';

import { RedisDistributedLock } from './redis-distributed-lock.adapter';

describe('RedisDistributedLock', () => {
  let lock: RedisDistributedLock;
  let mockRedisClient: any;

  beforeEach(() => {
    mockRedisClient = {
      set: jest.fn(),
      eval: jest.fn(),
    };

    lock = new RedisDistributedLock(
      mockRedisClient,
      metrics() as never,
      tracing() as never,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('acquires lock, executes work and releases lock via lua script', async () => {
    mockRedisClient.set.mockResolvedValue('OK');
    mockRedisClient.eval.mockResolvedValue(1);

    const workFn = jest.fn().mockResolvedValue('work_result');

    const result = await lock.withLock('story:123', { ttlMs: 5000 }, workFn);

    expect(result).toBe('work_result');
    expect(mockRedisClient.set).toHaveBeenCalledWith(
      'lock:story:123',
      expect.any(String),
      'PX',
      5000,
      'NX',
    );
    expect(mockRedisClient.eval).toHaveBeenCalledWith(
      expect.any(String),
      1,
      'lock:story:123',
      expect.any(String),
    );
  });

  it('releases lock even when work function throws an exception', async () => {
    mockRedisClient.set.mockResolvedValue('OK');
    mockRedisClient.eval.mockResolvedValue(1);

    const clearSpy = jest.spyOn(global, 'clearTimeout');
    const workFn = jest.fn().mockRejectedValue(new Error('Work error'));

    await expect(
      lock.withLock('story:456', { ttlMs: 5000 }, workFn),
    ).rejects.toThrow('Work error');

    expect(mockRedisClient.eval).toHaveBeenCalled();
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it('throws ConcurrencyConflictException if lock cannot be acquired after waitMs', async () => {
    mockRedisClient.set.mockResolvedValue(null);

    const workFn = jest.fn();

    await expect(
      lock.withLock('story:789', { ttlMs: 5000, waitMs: 100 }, workFn),
    ).rejects.toThrow(ConcurrencyConflictException);

    expect(workFn).not.toHaveBeenCalled();
  });

  it('extends the lease while work exceeds the original heartbeat interval', async () => {
    jest.useFakeTimers();
    mockRedisClient.set.mockResolvedValue('OK');
    mockRedisClient.eval.mockResolvedValue(1);
    let finishWork!: () => void;
    const work = new Promise<void>((resolve) => {
      finishWork = resolve;
    });

    const resultPromise = lock.withLock(
      'story:slow',
      { ttlMs: 300, extensionIntervalMs: 100 },
      () => work.then(() => 'done'),
    );
    await jest.advanceTimersByTimeAsync(101);
    expect(mockRedisClient.eval).toHaveBeenCalledWith(
      expect.stringContaining('pexpire'),
      1,
      'lock:story:slow',
      expect.any(String),
      '300',
    );
    finishWork();
    await expect(resultPromise).resolves.toBe('done');
  });

  it('does not report success after ownership is lost', async () => {
    jest.useFakeTimers();
    mockRedisClient.set.mockResolvedValue('OK');
    mockRedisClient.eval.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    let finishWork!: () => void;
    const work = new Promise<void>((resolve) => {
      finishWork = resolve;
    });
    const resultPromise = lock.withLock(
      'story:lost',
      { ttlMs: 300, extensionIntervalMs: 100 },
      () => work,
    );
    await jest.advanceTimersByTimeAsync(101);
    finishWork();
    await expect(resultPromise).rejects.toBeInstanceOf(
      ConcurrencyConflictException,
    );
  });

  it('fails closed when Redis is unavailable', async () => {
    const noRedisLock = new RedisDistributedLock(
      null,
      metrics() as never,
      tracing() as never,
    );
    const work = jest.fn();
    await expect(
      noRedisLock.withLock('story:closed', { ttlMs: 5000 }, work),
    ).rejects.toThrow('Distributed lock protection is unavailable');
    expect(work).not.toHaveBeenCalled();
  });
});

function metrics() {
  return { recordLock: jest.fn(), recordRedisError: jest.fn() };
}

function tracing() {
  return {
    inSpan: jest.fn((_name: string, _attributes: object, work: () => unknown) =>
      work(),
    ),
  };
}
