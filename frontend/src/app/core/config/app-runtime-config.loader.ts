import { environment } from '../../../environments/environment';

import { AppRuntimeConfig } from './app-config.token';

export async function loadAppRuntimeConfig(): Promise<AppRuntimeConfig> {
  const response = await fetch(`${environment.apiBaseUrl}/auth/client-config`, {
    method: 'GET',

    credentials: 'include',

    cache: 'no-store',

    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Không thể tải runtime auth config: HTTP ${response.status}`);
  }

  const body: unknown = await response.json();

  const csrf = parseCsrfConfig(body);

  return {
    apiBaseUrl: environment.apiBaseUrl,

    appName: environment.appName,

    production: environment.production,

    csrf,
  };
}

function parseCsrfConfig(value: unknown): AppRuntimeConfig['csrf'] {
  if (!isRecord(value) || value['success'] !== true) {
    throw new Error('Runtime auth config không đúng response envelope.');
  }

  const data = value['data'];

  if (!isRecord(data)) {
    throw new Error('Runtime auth config thiếu data.');
  }

  const csrf = data['csrf'];

  if (!isRecord(csrf)) {
    throw new Error('Runtime auth config thiếu csrf config.');
  }

  const enabled = csrf['enabled'];

  const cookieName = csrf['cookieName'];

  const headerName = csrf['headerName'];

  if (typeof enabled !== 'boolean') {
    throw new Error('Runtime csrf.enabled không hợp lệ.');
  }

  if (!isNonEmptyString(cookieName)) {
    throw new Error('Runtime csrf.cookieName không hợp lệ.');
  }

  if (!isNonEmptyString(headerName)) {
    throw new Error('Runtime csrf.headerName không hợp lệ.');
  }

  return {
    enabled,
    cookieName,
    headerName,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
