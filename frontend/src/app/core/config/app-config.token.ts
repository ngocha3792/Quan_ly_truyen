import { InjectionToken } from '@angular/core';

export interface AppRuntimeConfig {
  readonly apiBaseUrl: string;
  readonly appName: string;
  readonly production: boolean;

  readonly csrf: {
    readonly enabled: boolean;
    readonly cookieName: string;
    readonly headerName: string;
  };
}

export const APP_RUNTIME_CONFIG = new InjectionToken<AppRuntimeConfig>('APP_RUNTIME_CONFIG');
