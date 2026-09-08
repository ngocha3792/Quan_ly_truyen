import { loadAppRuntimeConfig, RuntimeConfigLoaderDependencies } from './app-runtime-config.loader';

const NOW = Date.parse('2026-09-09T00:00:00.000Z');

describe('loadAppRuntimeConfig offline fallback', () => {
  it('stores only versioned public runtime config after an online response', async () => {
    const storage = new MemoryStorage();
    const config = await loadAppRuntimeConfig(dependencies(storage, successfulFetch()));

    expect(config.features.offlineReadingEnabled).toBe(true);
    const cached = storage.value();
    expect(cached).toContain('"schemaVersion":1');
    expect(cached).not.toContain('accessToken');
    expect(cached).not.toContain('sessionId');
  });

  it('restores the last server-enabled feature config on a network-only failure', async () => {
    const storage = new MemoryStorage();
    await loadAppRuntimeConfig(dependencies(storage, successfulFetch()));

    const restored = await loadAppRuntimeConfig(
      dependencies(storage, async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    expect(restored.features.offlineReadingEnabled).toBe(true);
  });

  it.each([
    ['malformed', '{'],
    ['wrong schema', JSON.stringify(cachedRecord({ schemaVersion: 2 }))],
    ['stale', JSON.stringify(cachedRecord({ savedAt: NOW - 31 * 24 * 60 * 60 * 1000 }))],
    [
      'wrong environment',
      JSON.stringify(
        cachedRecord({ environment: { ...environmentRecord(), apiBaseUrl: '/other' } }),
      ),
    ],
  ])('rejects %s cached data', async (_case, cached) => {
    const storage = new MemoryStorage(cached);
    await expect(
      loadAppRuntimeConfig(
        dependencies(storage, async () => {
          throw new TypeError('offline');
        }),
      ),
    ).rejects.toThrowError(/không có cấu hình offline hợp lệ/);
  });

  it('uses cached config for a recoverable 503 response', async () => {
    const storage = new MemoryStorage(JSON.stringify(cachedRecord()));
    const config = await loadAppRuntimeConfig(
      dependencies(storage, async () => new Response(null, { status: 503 })),
    );
    expect(config.features.offlineReadingEnabled).toBe(true);
  });

  it('does not hide an authoritative 400 response behind cache', async () => {
    const storage = new MemoryStorage(JSON.stringify(cachedRecord()));
    await expect(
      loadAppRuntimeConfig(dependencies(storage, async () => new Response(null, { status: 400 }))),
    ).rejects.toThrowError(/HTTP 400/);
  });

  it('returns a clear error when the device has no cached config', async () => {
    await expect(
      loadAppRuntimeConfig(
        dependencies(new MemoryStorage(), async () => {
          throw new TypeError('offline');
        }),
      ),
    ).rejects.toThrowError(/không có cấu hình offline hợp lệ/);
  });
});

function dependencies(storage: Storage, fetcher: typeof fetch): RuntimeConfigLoaderDependencies {
  return { storage, fetch: fetcher, now: () => NOW };
}

function successfulFetch(): typeof fetch {
  return async () =>
    new Response(JSON.stringify({ success: true, data: publicConfig() }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
}

function cachedRecord(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    savedAt: NOW,
    environment: environmentRecord(),
    config: publicConfig(),
    ...overrides,
  };
}

function environmentRecord() {
  return { apiBaseUrl: '/api/v1', appName: 'TruyenHub', production: false };
}

function publicConfig() {
  return {
    features: {
      monetizationEnabled: false,
      paymentProviderEnabled: false,
      contentDocumentEnabled: true,
      portableCursorEnabled: true,
      realtimeProgressSyncEnabled: true,
      inlineCommentsEnabled: true,
      comicDeliveryEnabled: true,
      offlineReadingEnabled: true,
    },
    passwordPolicy: {
      minimumLength: 10,
      maximumLength: 72,
      maximumBytes: 72,
      requireLowercase: true,
      requireUppercase: true,
      requireNumber: true,
      requireSymbol: false,
    },
    passwordReset: { tokenExpiresInMinutes: 30 },
    csrf: { enabled: true, cookieName: 'csrf-token', headerName: 'x-csrf-token' },
  };
}

class MemoryStorage implements Storage {
  private readonly cache = new Map<string, string>();

  constructor(initial?: string) {
    if (initial !== undefined) this.cache.set('truyenhub.runtime-config.v1', initial);
  }
  get length(): number {
    return this.cache.size;
  }
  clear(): void {
    this.cache.clear();
  }
  getItem(key: string): string | null {
    return this.cache.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.cache.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.cache.delete(key);
  }
  setItem(key: string, value: string): void {
    this.cache.set(key, value);
  }
  value(): string {
    return [...this.cache.values()][0] ?? '';
  }
}
