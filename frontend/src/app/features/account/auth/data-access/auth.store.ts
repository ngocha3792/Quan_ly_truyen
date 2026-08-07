import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, of, tap } from 'rxjs';
import { getApiErrorMessage } from '../../../../core/http/api-error.util';
import {
  AuthMode,
  CurrentUser,
  LoginRequest,
  RegisterRequest,
} from '../domain/auth.models';
import { AuthFeatureRepository } from './auth.repository';

@Injectable()
export class AuthFeatureStore {
  private readonly repository = inject(AuthFeatureRepository);

  readonly mode = signal<AuthMode>('login');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly currentUser = signal<CurrentUser | null>(null);

  readonly isAuthenticated = computed(() => this.currentUser() !== null);

  setMode(mode: AuthMode): void {
    this.mode.set(mode);
    this.clearMessages();
  }

  clearMessages(): void {
    this.error.set(null);
    this.successMessage.set(null);
  }

  login(payload: LoginRequest, onSuccess?: () => void): void {
    this.loading.set(true);
    this.clearMessages();

    this.repository.login(payload).pipe(
      tap((res) => {
        this.loading.set(false);
        this.successMessage.set('Đăng nhập thành công!');
        if (onSuccess) onSuccess();
      }),
      catchError((err) => {
        this.loading.set(false);
        this.error.set(getApiErrorMessage(err, 'Đăng nhập không thành công.'));
        return of(null);
      })
    ).subscribe();
  }

  register(payload: RegisterRequest, onSuccess?: () => void): void {
    this.loading.set(true);
    this.clearMessages();

    this.repository.register(payload).pipe(
      tap(() => {
        this.loading.set(false);
        this.successMessage.set('Đăng ký thành công! Vui lòng kiểm tra email xác thực.');
        if (onSuccess) onSuccess();
      }),
      catchError((err) => {
        this.loading.set(false);
        this.error.set(getApiErrorMessage(err, 'Đăng ký không thành công.'));
        return of(null);
      })
    ).subscribe();
  }

  verifyEmail(token: string): void {
    this.loading.set(true);
    this.clearMessages();

    this.repository.verifyEmail(token).pipe(
      tap(() => {
        this.loading.set(false);
        this.successMessage.set('Xác thực email thành công!');
      }),
      catchError((err) => {
        this.loading.set(false);
        this.error.set(getApiErrorMessage(err, 'Xác thực email thất bại hoặc liên kết đã hết hạn.'));
        return of(null);
      })
    ).subscribe();
  }
}
