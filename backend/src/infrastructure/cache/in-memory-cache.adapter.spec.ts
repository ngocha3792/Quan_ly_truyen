import { ConfigService } from '@nestjs/config';

import { InMemoryCacheAdapter } from './in-memory-cache.adapter';

describe('InMemoryCacheAdapter', () => {
  let adapter: InMemoryCacheAdapter;

  beforeEach(() => {
    jest.useFakeTimers();
    adapter = new InMemoryCacheAdapter(
      new ConfigService({
        infrastructureFallback: {
          inMemoryStoreMaxEntries: 2,
          inMemoryStoreSweepIntervalMs: 1000,
        },
      }),
    );
  });

  afterEach(() => {
    adapter.onModuleDestroy();
    jest.useRealTimers();
  });

  it('evicts the oldest entry when bounded capacity is reached', async () => {
    await adapter.set('one', 1);
    await adapter.set('two', 2);
    await adapter.set('three', 3);
    expect(await adapter.get('one')).toBeNull();
    expect(await adapter.get('two')).toBe(2);
  });

  it('sweeps expired entries and clears its timer on shutdown', async () => {
    const clearSpy = jest.spyOn(global, 'clearInterval');
    await adapter.set('expired', 1, 1);
    jest.advanceTimersByTime(1001);
    expect(await adapter.get('expired')).toBeNull();
    adapter.onModuleDestroy();
    expect(clearSpy).toHaveBeenCalled();
  });
});
