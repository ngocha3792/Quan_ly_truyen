import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';

import { AuthStore } from '../../../../core/auth/auth.store';
import {
  ResetPasswordConfig,
  ResetPasswordResult,
  ResetPasswordStatus,
  ResetPasswordTokenValidation,
} from '../domain/reset-password.models';
import { ResetPasswordRepository } from '../domain/reset-password.repository';

@Injectable()
export class ResetPasswordStore {
  private readonly repository = inject(ResetPasswordRepository);

  private readonly auth = inject(AuthStore);

  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<ResetPasswordStatus>('idle');

  readonly config = signal<ResetPasswordConfig | null>(null);

  readonly tokenValidation = signal<ResetPasswordTokenValidation | null>(null);

  readonly result = signal<ResetPasswordResult | null>(null);

  readonly errorMessage = signal('');

  readonly currentToken = signal('');

  initialize(token: string): void {
    if (this.status() === 'validating') {
      return;
    }

    const normalizedToken = token.trim();

    this.currentToken.set(normalizedToken);

    if (!normalizedToken) {
      this.tokenValidation.set(null);
      this.result.set(null);
      this.status.set('invalid');
      this.errorMessage.set('Liên kết không chứa mã đặt lại mật khẩu.');
      return;
    }

    this.status.set('validating');

    this.errorMessage.set('');

    this.result.set(null);

    this.tokenValidation.set(null);

    forkJoin({
      config: this.repository.getConfig(),

      validation: this.repository.validateToken({
        token: normalizedToken,
      }),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ config, validation }) => {
          this.config.set(config);

          this.tokenValidation.set(validation);

          this.status.set('ready');
        },

        error: (error: unknown) => {
          /*
           * Fallback config phải khớp
           * password policy backend.
           */
          this.config.set({
            minimumLength: 8,
            maximumLength: 72,
            tokenExpiresInMinutes: 15,
          });

          this.handleTokenError(error);
        },
      });
  }

  submit(newPassword: string): void {
    if (this.status() === 'submitting') {
      return;
    }

    const token = this.currentToken();

    if (!token) {
      this.status.set('invalid');

      this.errorMessage.set('Không tìm thấy mã đặt lại mật khẩu.');

      return;
    }

    this.status.set('submitting');

    this.errorMessage.set('');

    this.result.set(null);

    this.repository
      .resetPassword({
        token,
        newPassword,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          /*
           * QUAN TRỌNG:
           *
           * Backend reset-password đã:
           *
           * - đổi password
           * - revoke toàn bộ session
           * - clear refresh cookie
           * - clear CSRF/auth cookie
           *
           * Access token ở frontend vẫn
           * đang nằm trong memory nếu user
           * reset password khi đang login.
           *
           * Vì vậy phải clear AuthStore.
           */
          this.auth.clearLocalSession();

          this.result.set(result);

          this.status.set('success');
        },

        error: (error: unknown) => {
          this.handleResetError(error);
        },
      });
  }

  retryValidation(): void {
    this.initialize(this.currentToken());
  }

  clearError(): void {
    if (this.status() === 'error') {
      this.status.set('ready');
    }

    this.errorMessage.set('');
  }

  private handleTokenError(error: unknown): void {
    const errorCode = error instanceof Error ? error.message : 'UNKNOWN_ERROR';

    switch (errorCode) {
      case 'EXPIRED_TOKEN':
        this.status.set('expired');

        this.errorMessage.set(
          'Liên kết đặt lại mật khẩu đã hết hạn. Vui lòng yêu cầu một liên kết mới.',
        );

        return;

      case 'INVALID_TOKEN':
        this.status.set('invalid');

        this.errorMessage.set('Liên kết đặt lại mật khẩu không hợp lệ hoặc đã được sử dụng.');

        return;

      case 'MISSING_TOKEN':
        this.status.set('invalid');

        this.errorMessage.set('Liên kết không chứa mã đặt lại mật khẩu.');

        return;

      default:
        this.status.set('error');

        this.errorMessage.set('Không thể kiểm tra liên kết đặt lại mật khẩu.');
    }
  }

  private handleResetError(error: unknown): void {
    const errorCode = error instanceof Error ? error.message : 'UNKNOWN_ERROR';

    switch (errorCode) {
      case 'EXPIRED_TOKEN':
        this.status.set('expired');

        this.errorMessage.set(
          'Liên kết đặt lại mật khẩu đã hết hạn. Vui lòng yêu cầu một liên kết mới.',
        );

        return;

      case 'INVALID_TOKEN':
        this.status.set('invalid');

        this.errorMessage.set('Liên kết đặt lại mật khẩu không hợp lệ hoặc đã được sử dụng.');

        return;

      case 'INVALID_PASSWORD':
        this.status.set('error');

        this.errorMessage.set('Mật khẩu mới chưa đáp ứng yêu cầu bảo mật.');

        return;

      default:
        this.status.set('error');

        this.errorMessage.set('Không thể cập nhật mật khẩu. Vui lòng thử lại.');
    }
  }
}
