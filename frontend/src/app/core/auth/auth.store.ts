import { HttpErrorResponse } from '@angular/common/http';
import { computed, ErrorHandler, inject, Injectable, signal } from '@angular/core';

import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

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

import {
  AuthSessionLifecycleEvent,
  AuthSessionLifecycleService,
} from './auth-session-lifecycle.service';

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

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'anonymous';

export type AuthBootstrapResult = 'authenticated' | 'anonymous' | 'unavailable';

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

  private readonly userState = signal<CurrentUser | null>(null);

  private readonly statusState = signal<AuthStatus>('idle');

  private readonly errorState = signal<string | null>(null);

  private bootstrapped = false;

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

  readonly user = this.userState.asReadonly();

  readonly status = this.statusState.asReadonly();

  readonly error = this.errorState.asReadonly();

  readonly isAuthenticated = computed(
    () => this.statusState() === 'authenticated' && Boolean(this.userState()),
  );

  constructor() {
    this.lifecycle.changes$.pipe(takeUntilDestroyed()).subscribe((event) => {
      this.handleLifecycleEvent(event);
    });
  }

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
    if (this.statusState() === 'authenticated' && this.userState()) {
      return of('authenticated');
    }

    if (this.statusState() === 'anonymous' && this.bootstrapped) {
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

    this.statusState.set('loading');

    const bootstrap$ = this.refreshService.refreshAccessToken().pipe(
      switchMap(() => this.api.me()),

      map((user: CurrentUser) => {
        this.setAuthenticated(user);

        return 'authenticated' as const;
      }),

      catchError((error: unknown) => {
        /**
         * Phase 1 vẫn giữ semantics hiện tại:
         *
         * 401 / 403 => rejected session.
         *
         * Phase 2 mới thay bằng error-code taxonomy.
         */
        if (this.isRejectedSession(error)) {
          if (this.statusState() !== 'anonymous') {
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
        if (this.statusState() !== 'idle') {
          this.lifecycle.loseAccess('bootstrap-temporarily-unavailable');
        }

        this.applyRecoverableIdleState();

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
    this.statusState.set('loading');

    this.errorState.set(null);

    return this.api.login(payload).pipe(
      switchMap((result) => this.acceptLogin(result)),

      catchError((error: unknown) => this.handleAuthenticationError(error)),
    );
  }

  register(payload: RegisterRequest): Observable<RegisterResponse> {
    this.statusState.set('loading');

    this.errorState.set(null);

    return this.api.register(payload).pipe(
      catchError((error: unknown) => {
        this.errorState.set(getApiErrorMessage(error));

        return throwError(() => error);
      }),

      finalize(() => {
        if (!this.userState()) {
          this.statusState.set('anonymous');
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
    this.statusState.set('loading');

    this.errorState.set(null);

    return this.api.confirmMfaEnrollment(request).pipe(
      switchMap((result) =>
        this.acceptLogin(result).pipe(
          map((user) => ({
            user,

            recoveryCodes: result.recoveryCodes ?? [],
          })),
        ),
      ),

      catchError((error: unknown) => this.handleAuthenticationError(error)),
    );
  }

  verifyMfa(request: VerifyMfaRequest): Observable<CurrentUser> {
    this.statusState.set('loading');

    this.errorState.set(null);

    return this.api.verifyMfa(request).pipe(
      switchMap((result) => this.acceptLogin(result)),

      catchError((error: unknown) => this.handleAuthenticationError(error)),
    );
  }

  refreshSession(): Observable<CurrentUser> {
    this.statusState.set('loading');

    this.errorState.set(null);

    return this.refreshService.refreshAccessToken().pipe(
      switchMap(() => this.api.me()),

      tap((user: CurrentUser) => {
        this.setAuthenticated(user);
      }),

      catchError((error: unknown) => {
        if (this.isRejectedSession(error)) {
          if (this.statusState() !== 'anonymous') {
            this.lifecycle.invalidateSession(
              'session-refresh-rejected',

              true,
            );
          }
        } else {
          if (this.statusState() !== 'idle') {
            this.lifecycle.loseAccess('session-refresh-temporarily-unavailable');
          }

          this.applyRecoverableIdleState();
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
    this.setAuthenticated(user);
  }

  clearError(): void {
    this.errorState.set(null);
  }

  private acceptLogin(result: LoginResponse): Observable<CurrentUser> {
    this.tokens.set(result.accessToken);

    return this.api.me().pipe(
      tap((user) => {
        this.setAuthenticated(user);
      }),
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

  private isRejectedSession(error: unknown): boolean {
    return isTerminalAuthSessionError(error);
  }

  private isRetryableLogoutError(error: unknown): boolean {
    return error instanceof HttpErrorResponse && (error.status === 0 || error.status >= 500);
  }

  private setAuthenticated(user: CurrentUser): void {
    this.sessionHint.markSessionPresent();

    this.userState.set(user);

    this.statusState.set('authenticated');

    this.bootstrapped = true;

    /*
     * Scope gồm cả userId + sessionId.
     *
     * Alice logout → Bob login
     * hoặc user login tạo session mới:
     * tất cả user-scoped state sẽ reset.
     */
    this.lifecycle.establishSession(
      user.id,

      user.sessionId,

      true,
    );
  }

  private applyAnonymousState(): void {
    this.tokens.clear();

    this.sessionHint.markSessionAbsent();

    this.userState.set(null);

    this.statusState.set('anonymous');

    this.bootstrapped = true;
  }

  private applyRecoverableIdleState(): void {
    /*
     * Không có access token đáng tin cậy nữa.
     */
    this.tokens.clear();

    /*
     * Không được giữ Alice/Bob trên UI trong lúc
     * chưa xác minh lại được phiên.
     */
    this.userState.set(null);

    /*
     * Giữ hint vì network/5xx không chứng minh
     * refresh cookie hết hạn.
     */
    this.sessionHint.markSessionPresent();

    this.statusState.set('idle');

    this.bootstrapped = false;
  }

  private handleLifecycleEvent(event: AuthSessionLifecycleEvent): void {
    if (event.kind === 'session-invalidated' || event.kind === 'session-cleared') {
      /*
       * Bao gồm:
       * - refresh rejected ở tab hiện tại
       * - logout tab khác
       * - refresh rejected ở tab khác
       */
      this.applyAnonymousState();

      return;
    }

    if (event.kind === 'access-lost') {
      this.applyRecoverableIdleState();

      return;
    }

    if (event.kind === 'session-established' && event.remote) {
      /*
       * Ví dụ:
       *
       * Tab A đang Alice.
       * Tab B login Bob.
       *
       * Refresh cookie của origin giờ thuộc
       * session Bob.
       *
       * Tab A không được tiếp tục hiển thị Alice
       * như authenticated.
       *
       * Đưa về idle để lần guard tiếp theo
       * bootstrap lại identity Bob.
       */
      this.applyRecoverableIdleState();
    }
  }
}
