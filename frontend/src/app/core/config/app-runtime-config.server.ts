import { environment } from '../../../environments/environment';
import { AppRuntimeConfig } from './app-config.token';

const DEVELOPMENT_API_ORIGIN = 'http://127.0.0.1:3000';
const DEVELOPMENT_PUBLIC_ORIGIN = 'http://localhost:4200';

export function loadServerAppRuntimeConfig(): AppRuntimeConfig {
  return {
    apiBaseUrl: `${serverApiOrigin()}${environment.apiBaseUrl}`,
    appName: environment.appName,
    production: environment.production,
    csrf: {
      enabled: false,
      cookieName: 'csrf_token',
      headerName: 'X-CSRF-Token',
    },
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
