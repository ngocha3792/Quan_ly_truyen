import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { TokenStore } from '../auth/token.store';
import { APP_RUNTIME_CONFIG } from '../config/app-config.token';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export const apiInterceptor: HttpInterceptorFn = (request, next) => {
  const config = inject(APP_RUNTIME_CONFIG);
  const tokenStore = inject(TokenStore);
  const isApiRequest = request.url.startsWith(config.apiBaseUrl);

  if (!isApiRequest) {
    return next(request);
  }

  let headers = request.headers;
  const token = tokenStore.accessToken();
  if (token && !headers.has('Authorization')) {
    headers = headers.set('Authorization', `Bearer ${token}`);
  }

  if (MUTATING_METHODS.has(request.method.toUpperCase())) {
    const csrfToken = readCookie('csrf_token');
    if (csrfToken && !headers.has('x-csrf-token')) {
      headers = headers.set('x-csrf-token', csrfToken);
    }
  }

  return next(
    request.clone({
      headers,
      withCredentials: true,
    }),
  );
};

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const prefix = `${encodeURIComponent(name)}=`;
  const entry = document.cookie
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(prefix));
  return entry ? decodeURIComponent(entry.slice(prefix.length)) : null;
}
