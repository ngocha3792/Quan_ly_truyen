import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, EMPTY, finalize, map, Observable, of, switchMap, tap, throwError } from 'rxjs';

import { getApiErrorMessage } from '../http/api-error.util';
import { AuthApiService } from './auth-api.service';
import { AuthRefreshService } from './auth-refresh.service';
import { AuthSessionHintStore } from './auth-session-hint.store';
import {
  MfaAuthenticationResult,
  MfaEnrollmentResponse,
  ConfirmMfaEnrollmentRequest,
  CurrentUser,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  VerifyMfaRequest,
} from './auth.models';
import { TokenStore } from './token.store';

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'anonymous';

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly api = inject(AuthApiService);
  private readonly refreshService: AuthRefreshService = inject(AuthRefreshService);
  private readonly tokens = inject(TokenStore);
  private readonly sessionHint = inject(AuthSessionHintStore);

  private readonly userState = signal<CurrentUser | null>(null);
  private readonly statusState = signal<AuthStatus>('idle');
  private readonly errorState = signal<string | null>(null);

  private bootstrapped = false;

  readonly user = this.userState.asReadonly();
  readonly status = this.statusState.asReadonly();
  readonly error = this.errorState.asReadonly();

  readonly isAuthenticated = computed(() => {
    return this.statusState() === 'authenticated' && Boolean(this.userState());
  });

  initialize(): void {
    if (this.bootstrapped) {
      return;
    }

    this.bootstrapped = true;
    this.errorState.set(null);

    if (!this.sessionHint.shouldAttemptRefresh()) {
      this.setAnonymous();
      return;
    }

    this.statusState.set('loading');

    this.refreshService
      .refreshAccessToken()
      .pipe(
        switchMap(() => this.api.me()),
        catchError((error: unknown) => {
          if (this.isRejectedSession(error)) {
            return of(null);
          }

          /*
           * Lỗi mạng/5xx không chứng minh refresh session đã hết hạn.
           * Giữ session hint và cho phép initialize() được gọi lại.
           */
          this.bootstrapped = false;
          this.statusState.set('idle');
          this.errorState.set(getApiErrorMessage(error));

          return EMPTY;
        }),
      )
      .subscribe((user: CurrentUser | null) => {
        if (!user) {
          this.setAnonymous();
          return;
        }

        this.setAuthenticated(user);
      });
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
        this.statusState.set('anonymous');
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
      tap((user: CurrentUser) => this.setAuthenticated(user)),
      catchError((error: unknown) => this.handleAuthenticationError(error)),
    );
  }

  logout(): void {
    this.api
      .logout()
      .pipe(catchError(() => of(undefined)))
      .subscribe(() => {
        this.clearLocalSession();
      });
  }

  clearLocalSession(): void {
    this.setAnonymous();
    this.errorState.set(null);
  }

  replaceCurrentUser(user: CurrentUser): void {
    this.setAuthenticated(user);
  }

  clearError(): void {
    this.errorState.set(null);
  }

  private acceptLogin(result: LoginResponse): Observable<CurrentUser> {
    this.tokens.set(result.accessToken);

    return this.api.me().pipe(tap((user) => this.setAuthenticated(user)));
  }

  private handleAuthenticationError(error: unknown): Observable<never> {
    this.setAnonymous();
    this.errorState.set(getApiErrorMessage(error));

    return throwError(() => error);
  }

  private isRejectedSession(error: unknown): boolean {
    return error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403);
  }

  private setAuthenticated(user: CurrentUser): void {
    /*
     * Đặc biệt quan trọng với OAuth:
     *
     * browser callback có refresh cookie,
     * sau đó refreshSession() dựng lại
     * access token.
     */
    this.sessionHint.markSessionPresent();

    this.userState.set(user);

    this.statusState.set('authenticated');
  }

  private setAnonymous(): void {
    this.tokens.clear();
    this.sessionHint.markSessionAbsent();
    this.userState.set(null);
    this.statusState.set('anonymous');
  }
}
