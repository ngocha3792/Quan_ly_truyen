import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';

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

  /**
   * Không can thiệp request ra ngoài backend API của ứng dụng.
   *
   * Ví dụ:
   * - CDN
   * - upload service
   * - third-party API
   */
  if (!request.url.startsWith(config.apiBaseUrl)) {
    return next(request);
  }

  /**
   * Ghi nhớ chính xác access token được sử dụng cho request này.
   *
   * Giá trị này rất quan trọng khi xử lý late 401:
   *
   * request A dùng token V1
   * request B dùng token V1
   *
   * A → 401 → refresh → tokenStore = V2
   * B → 401 đến trễ
   *
   * Khi B xử lý 401:
   * accessTokenUsedByRequest = V1
   * tokenStore.accessToken() = V2
   *
   * => Không refresh lần nữa.
   * => Chỉ retry B bằng V2.
   */
  const accessTokenUsedByRequest = tokenStore.accessToken();

  const preparedRequest = prepareApiRequest(request, accessTokenUsedByRequest);

  return next(preparedRequest).pipe(
    catchError((error: unknown) => {
      if (!shouldAttemptRefresh(error, request, accessTokenUsedByRequest)) {
        return throwError(() => error);
      }

      /**
       * Trước khi gọi refresh, kiểm tra xem một request khác
       * đã refresh access token hay chưa.
       *
       * Đây là lớp bảo vệ thứ hai ngoài single-flight.
       *
       * Nó xử lý trường hợp:
       *
       * request A ----401----refresh V1 -> V2
       *
       * request B -------------------------401
       *
       * B nhận 401 sau khi refresh của A đã hoàn tất.
       *
       * Lúc này AuthRefreshService có thể không còn refreshInFlight$,
       * nhưng tokenStore đã chứa V2.
       *
       * Vì vậy B chỉ cần retry với V2.
       */
      const latestAccessToken = tokenStore.accessToken();

      if (latestAccessToken && latestAccessToken !== accessTokenUsedByRequest) {
        return next(prepareApiRequest(request, latestAccessToken));
      }

      /**
       * Chưa có request nào refresh thành công.
       *
       * AuthRefreshService sẽ đảm bảo tất cả request concurrent
       * dùng chung đúng một /auth/refresh.
       */
      return refreshService.refreshAccessToken().pipe(
        switchMap((newAccessToken) => {
          return next(prepareApiRequest(request, newAccessToken));
        }),
      );
    }),
  );
};

function shouldAttemptRefresh(
  error: unknown,
  request: HttpRequest<unknown>,
  accessTokenUsedByRequest: string | null,
): boolean {
  /**
   * Chỉ refresh khi backend thực sự trả Unauthorized.
   */
  if (!(error instanceof HttpErrorResponse)) {
    return false;
  }

  if (error.status !== 401) {
    return false;
  }

  /**
   * Request ban đầu không có access token.
   *
   * Ví dụ user anonymous gọi API private.
   * Refresh ở đây không có ý nghĩa.
   */
  if (!accessTokenUsedByRequest) {
    return false;
  }

  /**
   * Login / register / refresh / forgot password...
   * tự đánh dấu SKIP_AUTH_REFRESH.
   *
   * Đặc biệt /auth/refresh tuyệt đối không được refresh chính nó.
   */
  if (request.context.get(SKIP_AUTH_REFRESH)) {
    return false;
  }

  return true;
}

function prepareApiRequest(
  request: HttpRequest<unknown>,
  accessToken: string | null,
): HttpRequest<unknown> {
  let headers = request.headers;

  /**
   * Chỉ tự thêm Authorization nếu caller chưa tự cung cấp.
   */
  if (accessToken && !headers.has('Authorization')) {
    headers = headers.set('Authorization', `Bearer ${accessToken}`);
  }

  /**
   * Double-submit CSRF protection.
   *
   * Backend refresh cookie là HttpOnly,
   * còn csrf_token cho phép frontend đọc và gửi lại qua header.
   */
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
