import { InjectionToken } from '@angular/core';
import { environment } from '../../../environments/environment';

export interface AppRuntimeConfig {
  readonly apiBaseUrl: string;
  readonly appName: string;
  readonly production: boolean;
}

export const APP_RUNTIME_CONFIG = new InjectionToken<AppRuntimeConfig>('APP_RUNTIME_CONFIG', {
  factory: () => environment,
});
