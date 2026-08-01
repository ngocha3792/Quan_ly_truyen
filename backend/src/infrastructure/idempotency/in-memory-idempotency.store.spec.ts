/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { ConfigService } from '@nestjs/config';

import { ConcurrencyConflictException } from '@/common/exceptions';

import { InMemoryIdempotencyStore } from './in-memory-idempotency.store';

describe('InMemoryIdempotencyStore', () => {
  let store: InMemoryIdempotencyStore;

  beforeEach(() => {
    jest.useFakeTimers();
    store = new InMemoryIdempotencyStore(
      new ConfigService({
        infrastructureFallback: {
          inMemoryStoreMaxEntries: 2,
          inMemoryStoreSweepIntervalMs: 1000,
        },
        idempotency: { maxResponseBytes: 1024 },
      }),
    );
  });

  afterEach(() => {
    store.onModuleDestroy();
    jest.useRealTimers();
  });

  it('prevents a stale owner from overwriting or deleting a newer lease', async () => {
    const leaseA = await store.acquire('key', 'hash-a', 1);
    expect(leaseA.acquired).toBe(true);
    jest.advanceTimersByTime(1001);
    const leaseB = await store.acquire('key', 'hash-b', 60);
    expect(leaseB.acquired).toBe(true);
    if (!leaseA.acquired || !leaseB.acquired) throw new Error('lease expected');

    await expect(
      store.saveResult(
        'key',
        leaseA.ownerToken,
        { statusCode: 200, responseBody: { stale: true } },
        60,
      ),
    ).rejects.toBeInstanceOf(ConcurrencyConflictException);
    await store.markFailed('key', leaseA.ownerToken);
    await store.saveResult(
      'key',
      leaseB.ownerToken,
      { statusCode: 201, responseBody: { owner: 'b' } },
      60,
    );
    const existing = await store.acquire('key', 'hash-b', 60);
    expect(existing).toEqual(
      expect.objectContaining({
        acquired: false,
        existingRecord: expect.objectContaining({
          state: 'COMPLETED',
          responseBody: { owner: 'b' },
        }),
      }),
    );
  });

  it('evicts oldest records and sweeps expired leases', async () => {
    await store.acquire('one', 'hash', 60);
    await store.acquire('two', 'hash', 60);
    await store.acquire('three', 'hash', 60);
    expect((await store.acquire('one', 'hash', 60)).acquired).toBe(true);

    await store.acquire('short', 'hash', 1);
    jest.advanceTimersByTime(1001);
    expect((await store.acquire('short', 'hash', 60)).acquired).toBe(true);
  });
});
