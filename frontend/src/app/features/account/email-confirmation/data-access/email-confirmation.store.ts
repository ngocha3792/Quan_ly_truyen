import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AuthStore } from '../../../../core/auth/auth.store';
import {
  EmailConfirmationResult,
  EmailConfirmationStatus,
} from '../domain/email-confirmation.models';
import { EmailConfirmationRepository } from '../domain/email-confirmation.repository';

@Injectable()
export class EmailConfirmationStore {
  private readonly repository = inject(EmailConfirmationRepository);

  private readonly auth = inject(AuthStore);

  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<EmailConfirmationStatus>('idle');

  readonly result = signal<EmailConfirmationResult | null>(null);

  readonly errorMessage = signal('');

  readonly currentToken = signal('');

  confirm(token: string): void {
    if (this.status() === 'confirming') {
      return;
    }

    const normalizedToken = token.trim();

    this.currentToken.set(normalizedToken);

    this.result.set(null);

    this.errorMessage.set('');

    if (!normalizedToken) {
      this.status.set('error');

      this.errorMessage.set('Liên kết xác nhận không chứa mã xác thực.');

      return;
    }

    this.status.set('confirming');

    this.repository
      .confirmEmail({
        token: normalizedToken,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          /*
           * Backend confirm change-email đã:
           *
           * - cập nhật email mới
           * - xác nhận email
           * - revoke toàn bộ session
           * - clear auth cookies
           *
           * Vì vậy accessToken/user local
           * cũng phải bị xóa.
           */
          this.auth.clearLocalSession();

          this.result.set(result);

          this.status.set('success');
        },

        error: (error: unknown) => {
          this.handleError(error);
        },
      });
  }

  retry(): void {
    const token = this.currentToken();

    if (!token) {
      this.status.set('error');

      this.errorMessage.set('Không tìm thấy mã xác nhận email.');

      return;
    }

    this.confirm(token);
  }

  private handleError(error: unknown): void {
    const errorCode = error instanceof Error ? error.message : 'UNKNOWN_ERROR';

    switch (errorCode) {
      case 'EXPIRED_TOKEN':
        this.status.set('expired');

        this.errorMessage.set(
          'Liên kết xác nhận đã hết hạn. Vui lòng yêu cầu thay đổi email lại từ trang bảo mật.',
        );

        return;

      case 'MISSING_TOKEN':
        this.status.set('error');

        this.errorMessage.set('Liên kết xác nhận không chứa mã xác thực.');

        return;

      case 'INVALID_TOKEN':
        this.status.set('error');

        this.errorMessage.set('Liên kết xác nhận không hợp lệ hoặc đã được sử dụng.');

        return;

      case 'EMAIL_IN_USE':
        this.status.set('error');

        this.errorMessage.set(
          'Email này đã được sử dụng bởi tài khoản khác. Vui lòng chọn một email khác.',
        );

        return;

      default:
        this.status.set('error');

        this.errorMessage.set('Không thể xác nhận email. Vui lòng thử lại sau.');
    }
  }
}
