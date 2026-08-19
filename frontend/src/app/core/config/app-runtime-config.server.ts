import { environment } from '../../../environments/environment';
import { AppRuntimeConfig } from './app-config.token';
import { parseAuthClientConfigResponse } from './auth-client-config.parser';

const DEVELOPMENT_API_ORIGIN = 'http://127.0.0.1:3000';
const DEVELOPMENT_PUBLIC_ORIGIN = 'http://localhost:4200';
const ROUTE_DISCOVERY_POSITIVE_INTEGER = 1;

let runtimeConfigPromise: Promise<AppRuntimeConfig> | null = null;

export function loadServerAppRuntimeConfig(): Promise<AppRuntimeConfig> {
  runtimeConfigPromise ??= fetchServerRuntimeConfig();
  return runtimeConfigPromise;
}

export function createRouteDiscoveryRuntimeConfig(): AppRuntimeConfig {
  return {
    apiBaseUrl: `${serverApiOrigin()}${environment.apiBaseUrl}`,
    appName: environment.appName,
    production: environment.production,
    passwordPolicy: {
      minimumLength: ROUTE_DISCOVERY_POSITIVE_INTEGER,
      maximumLength: ROUTE_DISCOVERY_POSITIVE_INTEGER,
      maximumBytes: ROUTE_DISCOVERY_POSITIVE_INTEGER,
      requireLowercase: false,
      requireUppercase: false,
      requireNumber: false,
      requireSymbol: false,
    },
    passwordReset: {
      tokenExpiresInMinutes: ROUTE_DISCOVERY_POSITIVE_INTEGER,
    },
    csrf: {
      enabled: false,
      cookieName: 'route_discovery',
      headerName: 'x-route-discovery',
    },
  };
}

async function fetchServerRuntimeConfig(): Promise<AppRuntimeConfig> {
  const apiBaseUrl = `${serverApiOrigin()}${environment.apiBaseUrl}`;
  const response = await fetch(`${apiBaseUrl}/auth/client-config`, {
    method: 'GET',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Không thể tải SSR runtime auth config: HTTP ${response.status}`);
  }

  const parsed = parseAuthClientConfigResponse(await response.json());

  return {
    apiBaseUrl,
    appName: environment.appName,
    production: environment.production,
    ...parsed,
  };
}

export function serverApiOrigin(): string {
  return readOrigin('SSR_API_ORIGIN', DEVELOPMENT_API_ORIGIN);
}

export function publicAppOrigin(): string {
  return readOrigin('APP_PUBLIC_ORIGIN', DEVELOPMENT_PUBLIC_ORIGIN);
}

export function assertProductionServerRuntimeConfig(): void {
  if (!environment.production) {
    return;
  }

  readRequiredOrigin('SSR_API_ORIGIN');
  readRequiredOrigin('APP_PUBLIC_ORIGIN');
}

function readOrigin(name: string, fallback: string): string {
  const raw = process.env[name]?.trim();
  return raw ? parseOrigin(name, raw) : fallback;
}

function readRequiredOrigin(name: string): string {
  const raw = process.env[name]?.trim();

  if (!raw) {
    throw new Error(`${name} is required for the production SSR runtime.`);
  }

  return parseOrigin(name, raw);
}

function parseOrigin(name: string, raw: string): string {
  let parsed: URL;

  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`${name} must be a valid absolute HTTP(S) URL.`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`${name} must use http: or https:.`);
  }

  return parsed.origin;
}
