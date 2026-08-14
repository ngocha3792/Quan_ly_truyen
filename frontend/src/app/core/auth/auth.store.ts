import { HttpErrorResponse } from '@angular/common/http';

import { ErrorHandler, inject, Injectable, signal } from '@angular/core';

import {
  catchError,
  finalize,
  map,
  Observable,
  of,
  retry,
  shareReplay,
  switchMap,
  tap,
  throwError,
  timer,
} from 'rxjs';

import { getApiErrorMessage } from '../http/api-error.util';

import { AuthApiService } from './auth-api.service';

import { AuthRefreshService } from './auth-refresh.service';

import { isTerminalAuthSessionError } from './auth-session-error.util';

import { AuthSessionLifecycleService } from './auth-session-lifecycle.service';

import { AuthSessionStateService } from './auth-session-state.service';

import type { AuthBootstrapResult } from './auth.store.types';

export type { AuthBootstrapResult, AuthStatus } from './auth.store.types';

import { AuthSessionHintStore } from './auth-session-hint.store';

import {
  ConfirmMfaEnrollmentRequest,
  CurrentUser,
  LoginRequest,
  LoginResponse,
  MfaAuthenticationResult,
  MfaEnrollmentResponse,
  RegisterRequest,
  RegisterResponse,
  VerifyMfaRequest,
} from './auth.models';

import { TokenStore } from './token.store';

@Injectable({
  providedIn: 'root',
})
export class AuthStore {
  private readonly api = inject(AuthApiService);

  private readonly refreshService = inject(AuthRefreshService);

  private readonly tokens = inject(TokenStore);

  private readonly sessionHint = inject(AuthSessionHintStore);

  private readonly lifecycle = inject(AuthSessionLifecycleService);

  private readonly errorHandler = inject(ErrorHandler);

  private readonly sessionState = inject(AuthSessionStateService);

  private readonly errorState = signal<string | null>(null);

  /**
   * Single-flight cho bootstrap auth trong cùng tab.
   *
   * Ví dụ:
   *
   * AppShell gọi initialize()
   * +
   * route guard gọi ensureInitialized()
   *
   * trong cùng thời điểm
   *
   * => chỉ có một refresh request.
   */
  private bootstrapInFlight$: Observable<AuthBootstrapResult> | null = null;

  readonly user = this.sessionState.user;

  readonly status = this.sessionState.status;

  readonly error = this.errorState.asReadonly();

  readonly isAuthenticated = this.sessionState.isAuthenticated;

  /**
   * Fire-and-forget bootstrap.
   *
   * Dùng cho AppShell hoặc component chỉ muốn
   * khởi động auth nhưng không cần biết kết quả.
   */
  initialize(): void {
    this.ensureInitialized().subscribe();
  }

  /**
   * Bootstrap auth có terminal result rõ ràng.
   *
   * Đây là API guard nên sử dụng.
   *
   * Observable luôn emit đúng một trong:
   *
   * authenticated
   * anonymous
   * unavailable
   *
   * rồi complete.
   *
   * Nhờ vậy guard không phải ngồi chờ AuthStatus
   * thoát khỏi idle/loading nữa.
   */
  ensureInitialized(): Observable<AuthBootstrapResult> {
    if (this.sessionState.status() === 'authenticated' && this.sessionState.user()) {
      return of('authenticated');
    }

    if (this.sessionState.status() === 'anonymous' && this.sessionState.isBootstrapped()) {
      return of('anonymous');
    }

    if (this.bootstrapInFlight$) {
      return this.bootstrapInFlight$;
    }

    this.errorState.set(null);

    /**
     * Browser đã biết chắc không có refresh session.
     */
    if (!this.sessionHint.shouldAttemptRefresh()) {
      this.lifecycle.clearSession(
        'bootstrap-without-session',

        false,
      );

      return of('anonymous');
    }

    this.sessionState.setLoading();

    const bootstrap$ = this.refreshService.refreshAccessToken().pipe(
      switchMap(() => this.api.me()),

      map((user: CurrentUser) => {
        this.sessionState.setAuthenticated(user);

        return 'authenticated' as const;
      }),

      catchError((error: unknown) => {
        /**
         * Chỉ terminal auth-session error code mới chứng minh
         * session thực sự không còn hợp lệ.
         *
         * Không suy luận chỉ từ HTTP 401/403 vì cùng HTTP status
         * có thể mang semantics khác nhau, ví dụ CSRF/origin failure.
         */
        if (this.isRejectedSession(error)) {
          if (this.sessionState.status() !== 'anonymous') {
            this.lifecycle.invalidateSession(
              'bootstrap-session-rejected',

              true,
            );
          }

          return of('anonymous' as const);
        }

        /**
         * Network / 5xx:
         *
         * chưa chứng minh refresh session chết.
         */
        if (this.sessionState.status() !== 'idle') {
          this.lifecycle.loseAccess('bootstrap-temporarily-unavailable');
        }

        this.sessionState.applyRecoverableIdleState();

        this.errorState.set(getApiErrorMessage(error));

        /**
         * Điểm quan trọng của Phase 1:
         *
         * không throw,
         * không EMPTY,
         * không chờ signal.
         *
         * Guard nhận terminal result này.
         */
        return of('unavailable' as const);
      }),

      tap(() => {
        /**
         * Bootstrap luôn emit đúng một terminal result.
         *
         * Clear single-flight trước khi downstream
         * nhận kết quả để user có thể retry ngay
         * khi result = unavailable.
         */
        this.bootstrapInFlight$ = null;
      }),

      shareReplay({
        bufferSize: 1,

        refCount: false,
      }),
    );

    this.bootstrapInFlight$ = bootstrap$;

    return bootstrap$;
  }

  login(payload: LoginRequest): Observable<CurrentUser> {
    this.sessionState.setLoading();

    this.errorState.set(null);

    return this.api.login(payload).pipe(
      /*
       * Chỉ lỗi của chính request authentication mới đi vào đây.
       *
       * Nếu POST /login đã 200 nhưng bước hydrate /auth/me phía sau
       * thất bại thì acceptLogin() sẽ tự phân loại lỗi đó.
       *
       * Đặt catchError trước switchMap là chủ ý.
       */
      catchError((error: unknown) => this.handleAuthenticationError(error)),

      switchMap((result) => this.acceptLogin(result)),
    );
  }

  register(payload: RegisterRequest): Observable<RegisterResponse> {
    this.sessionState.setLoading();

    this.errorState.set(null);

    return this.api.register(payload).pipe(
      catchError((error: unknown) => {
        this.errorState.set(getApiErrorMessage(error));

        return throwError(() => error);
      }),

      finalize(() => {
        if (!this.sessionState.user()) {
          this.sessionState.setAnonymousStatus();
        }
      }),
    );
  }

  beginMfaEnrollment(mfaTicket: string): Observable<MfaEnrollmentResponse> {
    this.errorState.set(null);

    return this.api.beginMfaEnrollment(mfaTicket).pipe(
      catchError((error: unknown) => {
        this.errorState.set(getApiErrorMessage(error));

        return throwError(() => error);
      }),
    );
  }

  confirmMfaEnrollment(request: ConfirmMfaEnrollmentRequest): Observable<MfaAuthenticationResult> {
    this.sessionState.setLoading();

    this.errorState.set(null);

    return this.api.confirmMfaEnrollment(request).pipe(
      /*
       * MFA request bị backend từ chối trước khi session được thiết lập
       * vẫn sử dụng authentication failure semantics cũ.
       */
      catchError((error: unknown) => this.handleAuthenticationError(error)),

      switchMap((result) =>
        this.acceptLogin(result).pipe(
          map((user) => ({
            user,

            recoveryCodes: result.recoveryCodes ?? [],
          })),
        ),
      ),
    );
  }

  verifyMfa(request: VerifyMfaRequest): Observable<CurrentUser> {
    this.sessionState.setLoading();

    this.errorState.set(null);

    return this.api.verifyMfa(request).pipe(
      /*
       * Chỉ lỗi verify MFA trước khi backend trả login result
       * mới được xem là authentication failure.
       */
      catchError((error: unknown) => this.handleAuthenticationError(error)),

      switchMap((result) => this.acceptLogin(result)),
    );
  }

  refreshSession(): Observable<CurrentUser> {
    this.sessionState.setLoading();

    this.errorState.set(null);

    return this.refreshService.refreshAccessToken().pipe(
      switchMap(() => this.api.me()),

      tap((user: CurrentUser) => {
        this.sessionState.setAuthenticated(user);
      }),

      catchError((error: unknown) => {
        if (this.isRejectedSession(error)) {
          if (this.sessionState.status() !== 'anonymous') {
            this.lifecycle.invalidateSession(
              'session-refresh-rejected',

              true,
            );
          }
        } else {
          if (this.sessionState.status() !== 'idle') {
            this.lifecycle.loseAccess('session-refresh-temporarily-unavailable');
          }

          this.sessionState.applyRecoverableIdleState();
        }

        this.errorState.set(getApiErrorMessage(error));

        return throwError(() => error);
      }),
    );
  }

  logout(): void {
    /*
     * Logout optimistic:
     *
     * Xóa local identity/access token ngay để UI không tiếp tục
     * coi user là authenticated.
     *
     * /auth/logout là Public và sử dụng refresh cookie + CSRF,
     * nên request backend không cần access token còn trong memory.
     */
    this.clearLocalSession();

    this.api
      .logout()
      .pipe(
        /*
         * Chỉ retry lỗi có khả năng tạm thời:
         *
         * status 0  -> network/offline/CORS connection failure
         * >= 500    -> backend/infrastructure temporary failure
         *
         * Không retry 4xx vì request retry y hệt cũng không sửa được.
         */
        retry({
          count: 2,

          delay: (error, retryCount) => {
            if (!this.isRetryableLogoutError(error)) {
              return throwError(() => error);
            }

            return timer(250 * retryCount);
          },
        }),
      )
      .subscribe({
        error: (error: unknown) => {
          /*
           * Local logout đã hoàn tất.
           *
           * Nhưng server chưa xác nhận revoke session.
           *
           * Không swallow lỗi nữa. ErrorHandler mặc định sẽ log;
           * nếu sau này project gắn Sentry/OpenTelemetry client thì
           * cũng có một điểm tập trung để capture lỗi này.
           */
          this.errorState.set(
            'Đã đăng xuất trên thiết bị này nhưng máy chủ chưa xác nhận thu hồi phiên.',
          );

          this.errorHandler.handleError(error);
        },
      });
  }

  clearLocalSession(): void {
    this.errorState.set(null);

    /*
     * Logout một tab phải logout UI
     * của các tab khác.
     */
    this.lifecycle.clearSession(
      'logout',

      true,
    );
  }

  replaceCurrentUser(user: CurrentUser): void {
    this.sessionState.setAuthenticated(user);
  }

  clearError(): void {
    this.errorState.set(null);
  }

  private acceptLogin(result: LoginResponse): Observable<CurrentUser> {
    /*
     * Backend đã trả authentication success.
     *
     * Tại thời điểm này refresh cookie đã được thiết lập,
     * vì vậy phải ghi session hint NGAY, không chờ /auth/me.
     *
     * Điều này cũng bảo vệ trường hợp:
     *
     * login 200
     * → browser có refresh cookie
     * → /me đang pending
     * → page reload / request bị interrupt
     *
     * Lần bootstrap tiếp theo vẫn phải thử refresh.
     */
    this.tokens.set(result.accessToken);

    this.sessionHint.markSessionPresent();

    return this.api.me().pipe(
      tap((user) => {
        this.sessionState.setAuthenticated(user);
      }),

      /*
       * Từ đây trở xuống login/MFA đã thành công.
       *
       * Lỗi /me không được đánh đồng với lỗi credential.
       */
      catchError((error: unknown) => this.handleSessionHydrationError(error)),
    );
  }

  private handleAuthenticationError(error: unknown): Observable<never> {
    /*
     * Lifecycle event synchronous reset AuthStore.
     *
     * Không gọi applyAnonymousState() riêng nữa.
     */
    this.lifecycle.clearSession(
      'authentication-failed',

      false,
    );

    this.errorState.set(getApiErrorMessage(error));

    return throwError(() => error);
  }

  private handleSessionHydrationError(error: unknown): Observable<never> {
    /*
     * /auth/me chạy sau khi backend đã authentication success.
     *
     * Không được dùng HTTP status đơn thuần để quyết định session chết.
     * isRejectedSession() sử dụng stable backend error code taxonomy.
     */
    if (this.isRejectedSession(error)) {
      /*
       * Ví dụ:
       *
       * AUTHENTICATION_REQUIRED
       * AUTH_CURRENT_USER_UNAVAILABLE
       * AUTH_ACCESS_TOKEN_BLACKLISTED
       * INVALID_TOKEN
       * TOKEN_EXPIRED
       *
       * Những code này chứng minh authenticated session hiện tại
       * không còn usable.
       */
      this.lifecycle.clearSession(
        'authentication-session-hydration-rejected',

        false,
      );
    } else {
      /*
       * Network / 5xx / unknown non-terminal error:
       *
       * login đã thành công,
       * refresh cookie có thể vẫn hoàn toàn hợp lệ.
       *
       * Không được mark session absent.
       */
      if (this.sessionState.status() !== 'idle') {
        this.lifecycle.loseAccess('authentication-session-hydration-temporarily-unavailable');
      }

      /*
       * AuthSessionLifecycleService emit synchronous,
       * nhưng vẫn apply trực tiếp giống semantics hiện tại
       * của bootstrap/refresh để state luôn deterministic.
       */
      this.sessionState.applyRecoverableIdleState();
    }

    this.errorState.set(getApiErrorMessage(error));

    return throwError(() => error);
  }

  private isRejectedSession(error: unknown): boolean {
    return isTerminalAuthSessionError(error);
  }

  private isRetryableLogoutError(error: unknown): boolean {
    return error instanceof HttpErrorResponse && (error.status === 0 || error.status >= 500);
  }
}
