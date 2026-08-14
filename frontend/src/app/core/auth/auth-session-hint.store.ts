import { inject, Injectable } from '@angular/core';

import { APP_RUNTIME_CONFIG } from '../config/app-config.token';

import { readBrowserCookie } from '../http/browser-cookie.util';

const SESSION_HINT_KEY = 'truyenhub.auth.has-refresh-session';

@Injectable({
  providedIn: 'root',
})
export class AuthSessionHintStore {
  private readonly config = inject(APP_RUNTIME_CONFIG);

  shouldAttemptRefresh(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    const storedHint = window.localStorage.getItem(SESSION_HINT_KEY);

    if (storedHint !== null) {
      return storedHint === 'true';
    }

    /*
     * Tên CSRF cookie đến trực tiếp
     * từ backend runtime config.
     */
    if (!this.config.csrf.enabled) {
      return false;
    }

    return readBrowserCookie(this.config.csrf.cookieName) !== null;
  }

  markSessionPresent(): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(SESSION_HINT_KEY, 'true');
  }

  markSessionAbsent(): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(SESSION_HINT_KEY, 'false');
  }
}
