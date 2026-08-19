import { environment } from '../../../environments/environment';

import { AppRuntimeConfig } from './app-config.token';
import { parseAuthClientConfigResponse } from './auth-client-config.parser';

export async function loadAppRuntimeConfig(): Promise<AppRuntimeConfig> {
  const response = await fetch(`${environment.apiBaseUrl}/auth/client-config`, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Không thể tải runtime auth config: HTTP ${response.status}`);
  }

  const parsed = parseAuthClientConfigResponse(await response.json());

  return {
    apiBaseUrl: environment.apiBaseUrl,
    appName: environment.appName,
    production: environment.production,
    ...parsed,
  };
}
