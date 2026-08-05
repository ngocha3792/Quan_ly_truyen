import {
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import {
  catchError,
  switchMap,
  throwError,
} from 'rxjs';

import { AuthRefreshService } from '../auth/auth-refresh.service';
import { TokenStore } from '../auth/token.store';
import { APP_RUNTIME_CONFIG } from '../config/app-config.token';
import { SKIP_AUTH_REFRESH } from './auth-http.context';
import { readBrowserCookie } from './browser-cookie.util';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export const apiInterceptor: HttpInterceptorFn = (request, next) => {
  const config = inject(APP_RUNTIME_CONFIG);
  const tokenStore = inject(TokenStore);
  const refreshService = inject(AuthRefreshService);

  if (!request.url.startsWith(config.apiBaseUrl)) {
    return next(request);
  }

  const accessToken = tokenStore.accessToken();
  const preparedRequest = prepareApiRequest(request, accessToken);

  return next(preparedRequest).pipe(
    catchError((error: unknown) => {
      const shouldRefresh =
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        Boolean(accessToken) &&
        !request.context.get(SKIP_AUTH_REFRESH);

      if (!shouldRefresh) {
        return throwError(() => error);
      }

      return refreshService.refreshAccessToken().pipe(
        switchMap((newAccessToken) =>
          next(prepareApiRequest(request, newAccessToken)),
        ),
      );
    }),
  );
};

function prepareApiRequest(
  request: HttpRequest<unknown>,
  accessToken: string | null,
): HttpRequest<unknown> {
  let headers = request.headers;

  if (accessToken && !headers.has('Authorization')) {
    headers = headers.set('Authorization', `Bearer ${accessToken}`);
  }

  if (MUTATING_METHODS.has(request.method.toUpperCase())) {
    const csrfToken = readBrowserCookie('csrf_token');

    if (csrfToken && !headers.has('x-csrf-token')) {
      headers = headers.set('x-csrf-token', csrfToken);
    }
  }

  return request.clone({
    headers,
    withCredentials: true,
  });
}
