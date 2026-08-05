import {
  computed,
  inject,
  Injectable,
  signal,
} from '@angular/core';

import {
  catchError,
  finalize,
  Observable,
  of,
  switchMap,
  tap,
  throwError,
} from 'rxjs';

import { getApiErrorMessage } from '../http/api-error.util';
import { AuthApiService } from './auth-api.service';
import { AuthSessionHintStore } from './auth-session-hint.store';

import {
  CurrentUser,
  LoginRequest,
  RegisterRequest,
  RegisterResponse,
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

    /**
     * Không gọi /refresh khi frontend biết chắc trình duyệt
     * chưa có refresh session.
     */
    if (!this.sessionHint.shouldAttemptRefresh()) {
      this.userState.set(null);
      this.statusState.set('anonymous');
      return;
    }

    this.statusState.set('loading');

    this.api
      .refresh()
      .pipe(
        tap((result) => {
          this.tokens.set(result.accessToken);
          this.sessionHint.markSessionPresent();
        }),

        switchMap(() => this.api.me()),

        catchError(() => {
          this.tokens.clear();
          this.sessionHint.markSessionAbsent();

          return of(null);
        }),
      )
      .subscribe((user) => {
        this.userState.set(user);

        this.statusState.set(
          user ? 'authenticated' : 'anonymous',
        );
      });
  }

  login(
    payload: LoginRequest,
  ): Observable<CurrentUser> {
    this.statusState.set('loading');
    this.errorState.set(null);

    return this.api.login(payload).pipe(
      tap((result) => {
        this.tokens.set(result.accessToken);
        this.sessionHint.markSessionPresent();
      }),

      switchMap(() => this.api.me()),

      tap((user) => {
        this.userState.set(user);
        this.statusState.set('authenticated');
      }),

      catchError((error: unknown) => {
        this.tokens.clear();
        this.sessionHint.markSessionAbsent();

        this.userState.set(null);
        this.statusState.set('anonymous');
        this.errorState.set(getApiErrorMessage(error));

        return throwError(() => error);
      }),
    );
  }

  register(
    payload: RegisterRequest,
  ): Observable<RegisterResponse> {
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

  logout(): void {
    this.api
      .logout()
      .pipe(
        catchError(() => of(undefined)),
      )
      .subscribe(() => {
        this.tokens.clear();
        this.sessionHint.markSessionAbsent();

        this.userState.set(null);
        this.errorState.set(null);
        this.statusState.set('anonymous');
      });
  }
  replaceCurrentUser(user: CurrentUser): void {
    this.userState.set(user);
    this.statusState.set('authenticated');
  }

  clearError(): void {
    this.errorState.set(null);
  }
}