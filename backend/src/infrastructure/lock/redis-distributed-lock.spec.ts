/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
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

    lock = new RedisDistributedLock(mockRedisClient);
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

    const workFn = jest.fn().mockRejectedValue(new Error('Work error'));

    await expect(
      lock.withLock('story:456', { ttlMs: 5000 }, workFn),
    ).rejects.toThrow('Work error');

    expect(mockRedisClient.eval).toHaveBeenCalled();
  });

  it('throws ConcurrencyConflictException if lock cannot be acquired after waitMs', async () => {
    mockRedisClient.set.mockResolvedValue(null);

    const workFn = jest.fn();

    await expect(
      lock.withLock('story:789', { ttlMs: 5000, waitMs: 100 }, workFn),
    ).rejects.toThrow(ConcurrencyConflictException);

    expect(workFn).not.toHaveBeenCalled();
  });
});
