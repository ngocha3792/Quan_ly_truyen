import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';

import { inject } from '@angular/core';

import { catchError, switchMap, throwError } from 'rxjs';

import { AuthRefreshService } from '../auth/auth-refresh.service';

import { TokenStore } from '../auth/token.store';

import { AppRuntimeConfig, APP_RUNTIME_CONFIG } from '../config/app-config.token';

import { SKIP_AUTH_REFRESH } from './auth-http.context';

import { readBrowserCookie } from './browser-cookie.util';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export const apiInterceptor: HttpInterceptorFn = (
  request,

  next,
) => {
  const config = inject(APP_RUNTIME_CONFIG);

  const tokenStore = inject(TokenStore);

  const refreshService = inject(AuthRefreshService);

  /*
   * Không can thiệp third-party request.
   */
  if (!request.url.startsWith(config.apiBaseUrl)) {
    return next(request);
  }

  /*
   * Ghi lại token chính xác request này đã dùng.
   *
   * Biến này rất quan trọng để xử lý late 401.
   */
  const accessTokenUsedByRequest = tokenStore.accessToken();

  const preparedRequest = prepareApiRequest(
    request,

    accessTokenUsedByRequest,

    config.csrf,
  );

  return next(preparedRequest).pipe(
    catchError((error: unknown) => {
      if (
        !shouldAttemptRefresh(
          error,

          request,

          accessTokenUsedByRequest,
        )
      ) {
        return throwError(() => error);
      }

      const latestAccessToken = tokenStore.accessToken();

      /*
       * CASE 1
       * ------
       *
       * Request A dùng token V1 → 401.
       *
       * Trong lúc A đang bay:
       * request B đã refresh V1 -> V2.
       *
       * Khi A nhận late 401 thì TokenStore đã là V2.
       *
       * Không refresh lần nữa.
       * Retry A trực tiếp bằng V2.
       */
      if (latestAccessToken && latestAccessToken !== accessTokenUsedByRequest) {
        return next(
          prepareApiRequest(
            request,

            latestAccessToken,

            config.csrf,
          ),
        );
      }

      /*
       * CASE 2
       * ------
       *
       * Request A refresh thất bại:
       *
       * AuthRefreshService đã:
       *
       *   TokenStore.clear()
       *
       * Sau đó request B mới nhận late 401.
       *
       * Không được gọi refresh lần nữa vì
       * refresh session vừa bị reject.
       *
       * Đây thay thế cho sessionHint guard.
       */
      if (!latestAccessToken) {
        return throwError(() => error);
      }

      /*
       * CASE 3
       * ------
       *
       * Token hiện tại vẫn chính là token request dùng.
       *
       * Chưa có caller nào refresh thành công/thất bại.
       *
       * Đi vào single-flight refresh.
       */
      return refreshService.refreshAccessToken().pipe(
        switchMap((newAccessToken) =>
          next(
            prepareApiRequest(
              request,

              newAccessToken,

              config.csrf,
            ),
          ),
        ),
      );
    }),
  );
};

function shouldAttemptRefresh(
  error: unknown,

  request: HttpRequest<unknown>,

  accessTokenUsedByRequest: string | null,
): boolean {
  if (!(error instanceof HttpErrorResponse)) {
    return false;
  }

  if (error.status !== 401) {
    return false;
  }

  /*
   * Anonymous request tuyệt đối không refresh.
   */
  if (!accessTokenUsedByRequest) {
    return false;
  }

  /*
   * /login, /refresh, /MFA...
   * có thể tự set context này để tránh recursive refresh.
   */
  if (request.context.get(SKIP_AUTH_REFRESH)) {
    return false;
  }

  return true;
}

function prepareApiRequest(
  request: HttpRequest<unknown>,

  accessToken: string | null,

  csrfConfig: AppRuntimeConfig['csrf'],
): HttpRequest<unknown> {
  let headers = request.headers;

  if (accessToken && !headers.has('Authorization')) {
    headers = headers.set(
      'Authorization',

      `Bearer ${accessToken}`,
    );
  }

  if (csrfConfig.enabled && MUTATING_METHODS.has(request.method.toUpperCase())) {
    const csrfToken = readBrowserCookie(csrfConfig.cookieName);

    if (csrfToken && !headers.has(csrfConfig.headerName)) {
      headers = headers.set(
        csrfConfig.headerName,

        csrfToken,
      );
    }
  }

  return request.clone({
    headers,

    withCredentials: true,
  });
}
