import { HttpErrorResponse } from '@angular/common/http';
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
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import {
  AdminMfaChallengeDetails,
  AdminMfaEnrollmentResponse,
} from '../../../../../core/auth/auth.models';
import { AuthStore } from '../../../../../core/auth/auth.store';
import { getRegisterValidationMessage } from '../../../../../core/auth/auth-validation';
import { ApiErrorEnvelope } from '../../../../../core/http/api-envelope.model';
import { getApiErrorMessage } from '../../../../../core/http/api-error.util';
import { BrandLogoComponent } from '../../../../../shared/components/brand-logo/brand-logo.component';
import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { MfaQrCodeComponent } from '../../../profile/secutity/ui/mfa-qr-code/mfa-qr-code.component';

type AuthDialogStage =
  | 'credentials'
  | 'mfa-enroll'
  | 'mfa-verify'
  | 'recovery-codes';

@Component({
  selector: 'app-auth-dialog',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    BrandLogoComponent,
    IconComponent,
    MfaQrCodeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './auth-dialog.component.html',
  styleUrl: './auth-dialog.component.scss',
})
export class AuthDialogComponent {
  readonly open = input(false);
  readonly closed = output<void>();

  protected readonly auth = inject(AuthStore);

  protected readonly mode = signal<'login' | 'register'>('login');
  protected readonly stage = signal<AuthDialogStage>('credentials');
  protected readonly submitting = signal(false);
  protected readonly message = signal<string | null>(null);
  protected readonly localError = signal<string | null>(null);

  protected readonly enrollment =
    signal<AdminMfaEnrollmentResponse | null>(null);
  protected readonly useRecoveryCode = signal(false);
  protected readonly recoveryCodes = signal<readonly string[]>([]);

  protected identifier = '';
  protected password = '';

  protected email = '';
  protected username = '';
  protected displayName = '';

  protected totpCode = '';
  protected recoveryCode = '';

  private mfaTicket: string | null = null;

  constructor() {
    effect(() => {
      if (!this.open()) {
        return;
      }

      this.resetChallenge();
      this.auth.clearError();
      this.localError.set(null);
      this.message.set(null);
    });
  }

  protected close(): void {
    if (this.submitting()) {
      return;
    }

    this.resetChallenge();
    this.closed.emit();
  }

  protected switchMode(mode: 'login' | 'register'): void {
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

  protected submitMfa(): void {
    if (this.stage() === 'mfa-enroll') {
      this.confirmEnrollment();
      return;
    }

    this.verifyMfa();
  }

  protected backToCredentials(): void {
    if (this.submitting()) {
      return;
    }

    this.resetChallenge();
    this.password = '';
  }

  protected finishRecoveryCodes(): void {
    this.recoveryCodes.set([]);
    this.resetChallenge();
    this.closed.emit();
  }

  private login(): void {
    const identifier = this.identifier.trim();

    if (!identifier || !this.password) {
      this.localError.set('Vui lòng nhập tài khoản và mật khẩu.');
      return;
    }

    this.submitting.set(true);

    this.auth
      .login({
        identifier,
        password: this.password,
        deviceName: 'TruyenHub Web',
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.password = '';
          this.closed.emit();
        },

        error: (error: unknown) => {
          const challenge = readAdminMfaChallenge(error);

          if (!challenge) {
            this.submitting.set(false);
            this.localError.set(getApiErrorMessage(error));
            return;
          }

          this.auth.clearError();
          this.localError.set(null);
          this.mfaTicket = challenge.mfaTicket;

          if (challenge.mode === 'verify') {
            this.submitting.set(false);
            this.stage.set('mfa-verify');
            return;
          }

          this.loadEnrollment(challenge.mfaTicket);
        },
      });
  }

  private loadEnrollment(mfaTicket: string): void {
    this.submitting.set(true);

    this.auth
      .beginAdminMfaEnrollment(mfaTicket)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: (enrollment) => {
          this.enrollment.set(enrollment);
          this.stage.set('mfa-enroll');
        },
        error: (error: unknown) => {
          this.localError.set(getApiErrorMessage(error));
          this.resetChallenge();
        },
      });
  }

  private confirmEnrollment(): void {
    const ticket = this.mfaTicket;
    const totpCode = this.totpCode.trim();

    if (!ticket || !/^\d{6}$/.test(totpCode)) {
      this.localError.set('Mã TOTP phải gồm đúng 6 chữ số.');
      return;
    }

    this.localError.set(null);
    this.submitting.set(true);

    this.auth
      .confirmAdminMfaEnrollment({
        mfaTicket: ticket,
        totpCode,
        deviceName: 'TruyenHub Web',
      })
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: (result) => {
          this.password = '';
          this.totpCode = '';
          this.recoveryCodes.set(result.recoveryCodes);

          if (result.recoveryCodes.length > 0) {
            this.stage.set('recovery-codes');
            return;
          }

          this.closed.emit();
        },
        error: (error: unknown) => {
          this.localError.set(getApiErrorMessage(error));
        },
      });
  }

  private verifyMfa(): void {
    const ticket = this.mfaTicket;

    if (!ticket) {
      this.localError.set('Phiên xác minh MFA không còn hợp lệ.');
      return;
    }

    const totpCode = this.totpCode.trim();
    const recoveryCode = this.recoveryCode.trim();

    if (this.useRecoveryCode()) {
      if (!recoveryCode) {
        this.localError.set('Vui lòng nhập mã khôi phục.');
        return;
      }
    } else if (!/^\d{6}$/.test(totpCode)) {
      this.localError.set('Mã TOTP phải gồm đúng 6 chữ số.');
      return;
    }

    this.localError.set(null);
    this.submitting.set(true);

    this.auth
      .verifyAdminMfa({
        mfaTicket: ticket,
        ...(this.useRecoveryCode()
          ? { recoveryCode }
          : { totpCode }),
        deviceName: 'TruyenHub Web',
      })
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => {
          this.password = '';
          this.resetChallenge();
          this.closed.emit();
        },
        error: (error: unknown) => {
          this.localError.set(getApiErrorMessage(error));
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

    const validationMessage = getRegisterValidationMessage(payload);

    if (validationMessage) {
      this.localError.set(validationMessage);
      return;
    }

    this.submitting.set(true);

    this.auth
      .register(payload)
      .pipe(finalize(() => this.submitting.set(false)))
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
          this.localError.set(getApiErrorMessage(error));
        },
      });
  }

  private resetChallenge(): void {
    this.stage.set('credentials');
    this.enrollment.set(null);
    this.useRecoveryCode.set(false);
    this.recoveryCodes.set([]);
    this.mfaTicket = null;
    this.totpCode = '';
    this.recoveryCode = '';
  }
}

function readAdminMfaChallenge(
  error: unknown,
): AdminMfaChallengeDetails | null {
  if (!(error instanceof HttpErrorResponse)) {
    return null;
  }

  const body = error.error as Partial<ApiErrorEnvelope> | undefined;
  const code = body?.error?.code;

  if (
    code !== 'AUTH_ADMIN_MFA_REQUIRED' &&
    code !== 'AUTH_ADMIN_MFA_ENROLLMENT_REQUIRED'
  ) {
    return null;
  }

  const details = body?.error?.details;
  const mfaTicket = details?.['mfaTicket'];
  const mode = details?.['mode'];
  const expiresAt = details?.['expiresAt'];

  if (
    typeof mfaTicket !== 'string' ||
    (mode !== 'enroll' && mode !== 'verify') ||
    typeof expiresAt !== 'string'
  ) {
    return null;
  }

  return {
    mfaTicket,
    mode,
    expiresAt,
  };
}
