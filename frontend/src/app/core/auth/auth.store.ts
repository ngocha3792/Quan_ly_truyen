import {
  computed,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import {
  catchError,
  finalize,
  map,
  Observable,
  of,
  switchMap,
  tap,
  throwError,
} from 'rxjs';

import { getApiErrorMessage } from '../http/api-error.util';
import { AuthApiService } from './auth-api.service';
import { AuthRefreshService } from './auth-refresh.service';
import { AuthSessionHintStore } from './auth-session-hint.store';
import {
  AdminMfaAuthenticationResult,
  AdminMfaEnrollmentResponse,
  ConfirmAdminMfaEnrollmentRequest,
  CurrentUser,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  VerifyAdminMfaRequest,
} from './auth.models';
import { TokenStore } from './token.store';

export type AuthStatus =
  | 'idle'
  | 'loading'
  | 'authenticated'
  | 'anonymous';

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
    return (
      this.statusState() === 'authenticated' &&
      Boolean(this.userState())
    );
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
        catchError(() => of(null)),
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

  beginAdminMfaEnrollment(
    mfaTicket: string,
  ): Observable<AdminMfaEnrollmentResponse> {
    this.errorState.set(null);

    return this.api.beginAdminMfaEnrollment(mfaTicket).pipe(
      catchError((error: unknown) => {
        this.errorState.set(getApiErrorMessage(error));

        return throwError(() => error);
      }),
    );
  }

  confirmAdminMfaEnrollment(
    request: ConfirmAdminMfaEnrollmentRequest,
  ): Observable<AdminMfaAuthenticationResult> {
    this.statusState.set('loading');
    this.errorState.set(null);

    return this.api.confirmAdminMfaEnrollment(request).pipe(
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

  verifyAdminMfa(
    request: VerifyAdminMfaRequest,
  ): Observable<CurrentUser> {
    this.statusState.set('loading');
    this.errorState.set(null);

    return this.api.verifyAdminMfa(request).pipe(
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
    this.sessionHint.markSessionPresent();

    return this.api.me().pipe(
      tap((user) => this.setAuthenticated(user)),
    );
  }

  private handleAuthenticationError(
    error: unknown,
  ): Observable<never> {
    this.setAnonymous();
    this.errorState.set(getApiErrorMessage(error));

    return throwError(() => error);
  }

  private setAuthenticated(user: CurrentUser): void {
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
