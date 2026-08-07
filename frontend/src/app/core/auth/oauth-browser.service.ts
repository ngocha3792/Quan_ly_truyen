import { inject, Injectable } from '@angular/core';

import { Router } from '@angular/router';

import { APP_RUNTIME_CONFIG } from '../config/app-config.token';

import type { OAuthProvider } from './auth.models';

const OAUTH_RETURN_URL_KEY = 'truyenhub.oauth.return-url';

@Injectable({
  providedIn: 'root',
})
export class OAuthBrowserService {
  private readonly config = inject(APP_RUNTIME_CONFIG);

  private readonly router = inject(Router);

  start(provider: OAuthProvider): void {
    if (typeof window === 'undefined') {
      return;
    }

    const returnUrl = sanitizeReturnUrl(this.router.url);

    window.sessionStorage.setItem(
      OAUTH_RETURN_URL_KEY,

      returnUrl,
    );

    const apiBaseUrl = this.config.apiBaseUrl.replace(/\/+$/u, '');

    /*
     * Đây là browser navigation,
     * không phải Angular HttpClient.
     *
     * Backend sẽ set OAuth state
     * cookie rồi 302 sang provider.
     */
    window.location.assign(`${apiBaseUrl}/auth/oauth/${provider}`);
  }

  consumeReturnUrl(): string {
    if (typeof window === 'undefined') {
      return '/';
    }

    const stored = window.sessionStorage.getItem(OAUTH_RETURN_URL_KEY);

    window.sessionStorage.removeItem(OAUTH_RETURN_URL_KEY);

    return sanitizeReturnUrl(stored);
  }

  clearReturnUrl(): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.sessionStorage.removeItem(OAUTH_RETURN_URL_KEY);
  }
}

function sanitizeReturnUrl(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return '/';
  }

  /*
   * Tránh loop callback.
   */
  if (value.startsWith('/oauth/callback')) {
    return '/';
  }

  return value;
}
