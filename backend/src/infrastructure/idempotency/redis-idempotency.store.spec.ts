/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { ConfigService } from '@nestjs/config';

import {
  ConcurrencyConflictException,
  ServiceUnavailableException,
} from '@/common/exceptions';

import { RedisIdempotencyStore } from './redis-idempotency.store';

describe('RedisIdempotencyStore', () => {
  const redis = { set: jest.fn(), get: jest.fn(), eval: jest.fn() };

  beforeEach(() => jest.resetAllMocks());

  function create(
    mode: 'closed' | 'open' = 'closed',
    client: typeof redis | null = redis,
  ): RedisIdempotencyStore {
    return new RedisIdempotencyStore(
      client as never,
      new ConfigService({ idempotency: { failureMode: mode } }),
      { recordRedisError: jest.fn() } as never,
    );
  }

  it('returns an owner token after acquiring a processing lease', async () => {
    redis.set.mockResolvedValue('OK');
    const result = await create().acquire('hashed-key', 'request-hash', 60);
    expect(result).toEqual({ acquired: true, ownerToken: expect.any(String) });
    const serialized = redis.set.mock.calls[0][1] as string;
    expect(JSON.parse(serialized)).toEqual(
      expect.objectContaining({
        state: 'PROCESSING',
        ownerToken: expect.any(String),
      }),
    );
  });

  it('uses Lua CAS for saveResult and rejects ownership loss', async () => {
    redis.eval.mockResolvedValueOnce(0);
    await expect(
      create().saveResult(
        'hashed-key',
        'stale-owner',
        { statusCode: 200, responseBody: { stale: true } },
        60,
      ),
    ).rejects.toBeInstanceOf(ConcurrencyConflictException);
    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining('current.ownerToken ~= ARGV[1]'),
      1,
      'hashed-key',
      'stale-owner',
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(String),
      '60',
    );
  });

  it('uses owner-checked Lua when marking a request failed', async () => {
    redis.eval.mockResolvedValue(0);
    await create().markFailed('hashed-key', 'stale-owner');
    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining('current.ownerToken ~= ARGV[1]'),
      1,
      'hashed-key',
      'stale-owner',
    );
  });

  it('fails closed and explicitly permits open mode', async () => {
    await expect(
      create('closed', null).acquire('key', 'hash', 60),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(
      create('open', null).acquire('key', 'hash', 60),
    ).resolves.toEqual({
      acquired: true,
      ownerToken: expect.any(String),
    });
  });
});
