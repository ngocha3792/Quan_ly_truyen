import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';

import { AuthStore } from '../../../../core/auth/auth.store';
import { getRegisterValidationMessage } from '../../../../core/auth/auth-validation';
import { getApiErrorMessage } from '../../../../core/http/api-error.util';

import { BrandLogoComponent } from '../../../../shared/components/brand-logo/brand-logo.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-auth-dialog',
  standalone: true,
  imports: [
    FormsModule,
    BrandLogoComponent,
    IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './auth-dialog.component.html',
  styleUrl: './auth-dialog.component.scss',
})
export class AuthDialogComponent {
  readonly open = input(false);
  readonly closed = output<void>();

  protected readonly auth = inject(AuthStore);

  protected readonly mode =
    signal<'login' | 'register'>('login');

  protected readonly submitting = signal(false);
  protected readonly message = signal<string | null>(null);
  protected readonly localError = signal<string | null>(null);

  protected identifier = '';
  protected password = '';

  protected email = '';
  protected username = '';
  protected displayName = '';

  constructor() {
    effect(() => {
      if (!this.open()) {
        return;
      }

      this.auth.clearError();
      this.localError.set(null);
      this.message.set(null);
    });
  }

  protected close(): void {
    if (this.submitting()) {
      return;
    }

    this.closed.emit();
  }

  protected switchMode(
    mode: 'login' | 'register',
  ): void {
    this.mode.set(mode);

    this.localError.set(null);
    this.message.set(null);
    this.auth.clearError();
  }

  protected submit(): void {
    this.localError.set(null);
    this.message.set(null);

    if (this.mode() === 'login') {
      this.login();
      return;
    }

    this.register();
  }

  private login(): void {
    const identifier = this.identifier.trim();

    if (!identifier || !this.password) {
      this.localError.set(
        'Vui lòng nhập tài khoản và mật khẩu.',
      );
      return;
    }

    this.submitting.set(true);

    this.auth
      .login({
        identifier,
        password: this.password,
        deviceName: 'TruyenHub Web',
      })
      .pipe(
        finalize(() => {
          this.submitting.set(false);
        }),
      )
      .subscribe({
        next: () => {
          this.password = '';
          this.closed.emit();
        },

        error: (error: unknown) => {
          this.localError.set(
            getApiErrorMessage(error),
          );
        },
      });
  }

  private register(): void {
    const payload = {
      email: this.email.trim(),
      username: this.username.trim(),
      displayName: this.displayName.trim(),
      password: this.password,
    };

    const validationMessage =
      getRegisterValidationMessage(payload);

    if (validationMessage) {
      this.localError.set(validationMessage);
      return;
    }

    this.submitting.set(true);

    this.auth
      .register(payload)
      .pipe(
        finalize(() => {
          this.submitting.set(false);
        }),
      )
      .subscribe({
        next: (result) => {
          this.message.set(
            [
              'Đăng ký thành công.',
              `Hãy kiểm tra email ${result.email}`,
              'để xác minh tài khoản.',
            ].join(' '),
          );

          this.mode.set('login');
          this.identifier = result.email;
          this.password = '';
        },

        error: (error: unknown) => {
          this.localError.set(
            getApiErrorMessage(error),
          );
        },
      });
  }
}