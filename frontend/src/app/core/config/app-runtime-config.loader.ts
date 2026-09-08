import { environment } from '../../../environments/environment';

import type { AppRuntimeConfig } from './app-config.token';
import { parseAuthClientConfigResponse } from './auth-client-config.parser';

const CACHE_KEY = 'truyenhub.runtime-config.v1';
const CACHE_SCHEMA_VERSION = 1;
const CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export interface RuntimeConfigLoaderDependencies {
  readonly fetch: typeof fetch;
  readonly storage: Storage | null;
  readonly now: () => number;
}

export async function loadAppRuntimeConfig(
  dependencies: RuntimeConfigLoaderDependencies = browserDependencies(),
): Promise<AppRuntimeConfig> {
  try {
    const response = await dependencies.fetch(`${environment.apiBaseUrl}/auth/client-config`, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new RuntimeConfigHttpError(response.status);

    let parsed: ReturnType<typeof parseAuthClientConfigResponse>;
    try {
      parsed = parseAuthClientConfigResponse(await response.json());
    } catch (error) {
      throw new RuntimeConfigContractError(error);
    }
    const config = currentEnvironmentConfig(parsed);
    writeCachedConfig(dependencies.storage, parsed, dependencies.now());
    return config;
  } catch (error) {
    if (
      error instanceof RuntimeConfigContractError ||
      (error instanceof RuntimeConfigHttpError && !error.recoverable)
    ) {
      throw error;
    }
    const cached = readCachedConfig(dependencies.storage, dependencies.now());
    if (cached) return cached;
    throw new Error('Không thể tải runtime config và không có cấu hình offline hợp lệ.', {
      cause: error,
    });
  }
}

function browserDependencies(): RuntimeConfigLoaderDependencies {
  return {
    fetch,
    storage: typeof localStorage === 'undefined' ? null : localStorage,
    now: Date.now,
  };
}

function currentEnvironmentConfig(
  parsed: ReturnType<typeof parseAuthClientConfigResponse>,
): AppRuntimeConfig {
  return {
    apiBaseUrl: environment.apiBaseUrl,
    appName: environment.appName,
    production: environment.production,
    ...parsed,
  };
}

function writeCachedConfig(
  storage: Storage | null,
  parsed: ReturnType<typeof parseAuthClientConfigResponse>,
  now: number,
): void {
  if (!storage) return;
  try {
    storage.setItem(
      CACHE_KEY,
      JSON.stringify({
        schemaVersion: CACHE_SCHEMA_VERSION,
        savedAt: now,
        environment: {
          apiBaseUrl: environment.apiBaseUrl,
          appName: environment.appName,
          production: environment.production,
        },
        config: parsed,
      }),
    );
  } catch {
    // The fetched config remains usable when persistent storage is unavailable.
  }
}

function readCachedConfig(storage: Storage | null, now: number): AppRuntimeConfig | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(CACHE_KEY);
    if (!raw) return null;
    const record = JSON.parse(raw) as unknown;
    if (!isRecord(record) || record['schemaVersion'] !== CACHE_SCHEMA_VERSION) return null;
    const savedAt = record['savedAt'];
    if (
      !Number.isFinite(savedAt) ||
      (savedAt as number) > now ||
      now - (savedAt as number) > CACHE_MAX_AGE_MS
    ) {
      return null;
    }
    if (!matchesCurrentEnvironment(record['environment'])) return null;
    const parsed = parseAuthClientConfigResponse({ success: true, data: record['config'] });
    return currentEnvironmentConfig(parsed);
  } catch {
    return null;
  }
}

function matchesCurrentEnvironment(value: unknown): boolean {
  return (
    isRecord(value) &&
    value['apiBaseUrl'] === environment.apiBaseUrl &&
    value['appName'] === environment.appName &&
    value['production'] === environment.production
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

class RuntimeConfigHttpError extends Error {
  readonly recoverable: boolean;

  constructor(readonly status: number) {
    super(`Không thể tải runtime auth config: HTTP ${status}`);
    this.name = 'RuntimeConfigHttpError';
    this.recoverable = status === 408 || status === 429 || status >= 500;
  }
}

class RuntimeConfigContractError extends Error {
  constructor(cause: unknown) {
    super('Runtime auth config trả về dữ liệu không hợp lệ.', { cause });
    this.name = 'RuntimeConfigContractError';
  }
}
