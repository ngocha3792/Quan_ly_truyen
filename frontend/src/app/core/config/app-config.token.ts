import { InjectionToken } from '@angular/core';

export interface AuthPasswordPolicyConfig {
  readonly minimumLength: number;
  readonly maximumLength: number;
  readonly maximumBytes: number;
  readonly requireLowercase: boolean;
  readonly requireUppercase: boolean;
  readonly requireNumber: boolean;
  readonly requireSymbol: boolean;
}

export interface AuthPasswordResetConfig {
  readonly tokenExpiresInMinutes: number;
}

export interface AppRuntimeConfig {
  readonly apiBaseUrl: string;
  readonly appName: string;
  readonly production: boolean;
  readonly passwordPolicy: AuthPasswordPolicyConfig;
  readonly passwordReset: AuthPasswordResetConfig;
  readonly csrf: {
    readonly enabled: boolean;
    readonly cookieName: string;
    readonly headerName: string;
  };
}

export const APP_RUNTIME_CONFIG = new InjectionToken<AppRuntimeConfig>('APP_RUNTIME_CONFIG');
