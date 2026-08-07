import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  OnDestroy,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthApiService } from '../../../../../core/auth/auth-api.service';
import {
  MfaChallengeDetails,
  MfaEnrollmentResponse,
  OAuthProvider,
} from '../../../../../core/auth/auth.models';
import { AuthStore } from '../../../../../core/auth/auth.store';
import { getRegisterValidationMessage } from '../../../../../core/auth/auth-validation';
import { OAuthBrowserService } from '../../../../../core/auth/oauth-browser.service';
import { ApiErrorEnvelope } from '../../../../../core/http/api-envelope.model';
import { getApiErrorMessage } from '../../../../../core/http/api-error.util';
import { BrandLogoComponent } from '../../../../../shared/components/brand-logo/brand-logo.component';
import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { MfaQrCodeComponent } from '../../../profile/secutity/ui/mfa-qr-code/mfa-qr-code.component';

type AuthDialogStage =
  | 'credentials'
  | 'verify-email'
  | 'mfa-enroll'
  | 'mfa-verify'
  | 'recovery-codes';

/**
 * Backend hiện dùng:
 *
 * AUTH_EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS=60
 *
 * Đây chỉ là UX cooldown.
 * Backend vẫn là nguồn kiểm soát cooldown thực sự.
 */
const RESEND_VERIFICATION_COOLDOWN_SECONDS = 60;

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
export class AuthDialogComponent implements OnDestroy {
  readonly open = input(false);
  readonly initialMfaChallenge = input<MfaChallengeDetails | null>(null);
  readonly closed = output<void>();

  protected readonly auth = inject(AuthStore);

  private readonly authApi = inject(AuthApiService);
  private readonly oauth = inject(OAuthBrowserService);

  protected readonly mode = signal<'login' | 'register'>('login');

  protected readonly stage = signal<AuthDialogStage>('credentials');

  protected readonly submitting = signal(false);

  protected readonly message = signal<string | null>(null);

  protected readonly localError = signal<string | null>(null);

  protected readonly enrollment = signal<MfaEnrollmentResponse | null>(null);

  protected readonly useRecoveryCode = signal(false);

  protected readonly recoveryCodes = signal<readonly string[]>([]);

  protected readonly resendCooldownSeconds = signal(0);

  protected identifier = '';

  protected password = '';

  protected email = '';

  protected username = '';

  protected displayName = '';

  protected verificationEmail = '';

  protected totpCode = '';

  protected recoveryCode = '';

  private mfaTicket: string | null = null;

  private resendCooldownTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    effect(() => {
      const isOpen = this.open();

      const initialChallenge = this.initialMfaChallenge();

      if (!isOpen) {
        return;
      }

      this.resetChallenge();

      this.auth.clearError();

      this.localError.set(null);

      this.message.set(null);

      /*
       * OAuth callback có thể mở dialog
       * thẳng ở stage MFA.
       */
      if (initialChallenge) {
        this.startMfaChallenge(initialChallenge);
      }
    });
  }

  ngOnDestroy(): void {
    this.stopResendCooldown();
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

  protected resendVerification(): void {
    if (
      this.submitting() ||
      this.resendCooldownSeconds() > 0
    ) {
      return;
    }

    const email = this.verificationEmail.trim();

    if (!isValidEmail(email)) {
      this.localError.set(
        'Vui lòng nhập địa chỉ email hợp lệ.',
      );

      return;
    }

    this.localError.set(null);

    this.message.set(null);

    this.submitting.set(true);

    this.authApi
      .resendVerification(email)
      .pipe(
        finalize(() => {
          this.submitting.set(false);
        }),
      )
      .subscribe({
        next: (result) => {
          /**
           * Backend cố tình trả message giống nhau
           * dù email:
           *
           * - không tồn tại
           * - đã verify
           * - đang cooldown
           *
           * Không thay đổi wording theo suy đoán ở frontend.
           */
          this.message.set(result.message);

          this.startResendCooldown();
        },

        error: (error: unknown) => {
          this.localError.set(
            getApiErrorMessage(error),
          );
        },
      });
  }

  protected backToCredentials(): void {
    if (this.submitting()) {
      return;
    }

    this.resetChallenge();

    this.password = '';

    this.localError.set(null);

    this.message.set(null);

    this.auth.clearError();
  }

  protected finishRecoveryCodes(): void {
    this.recoveryCodes.set([]);

    this.resetChallenge();

    this.closed.emit();
  }

  protected continueWithOAuth(
    provider: OAuthProvider,
  ): void {
    if (this.submitting()) {
      return;
    }

    this.auth.clearError();

    this.localError.set(null);

    this.message.set(null);

    this.oauth.start(provider);
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
      .subscribe({
        next: () => {
          this.submitting.set(false);

          this.password = '';

          this.closed.emit();
        },

        error: (error: unknown) => {
          /**
           * Account tồn tại nhưng email chưa verify.
           *
           * Nếu user login bằng email, prefill email đó.
           *
           * Nếu user login bằng username, backend không nên
           * trả email thật để tránh information leak.
           * Khi đó user tự nhập email vào form resend.
           */
          if (
            readApiErrorCode(error) ===
            'AUTH_EMAIL_NOT_VERIFIED'
          ) {
            this.submitting.set(false);

            this.password = '';

            this.openEmailVerificationStage(
              isValidEmail(identifier)
                ? identifier
                : '',
              'Tài khoản này chưa xác minh email. Bạn có thể yêu cầu gửi lại email xác minh.',
            );

            return;
          }

          const challenge =
            readMfaChallenge(error);

          if (!challenge) {
            this.submitting.set(false);

            this.localError.set(
              getApiErrorMessage(error),
            );

            return;
          }

          this.startMfaChallenge(challenge);
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
      this.localError.set(
        validationMessage,
      );

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
          this.mode.set('login');

          this.identifier = result.email;

          this.password = '';

          this.openEmailVerificationStage(
            result.email,
            `Đăng ký thành công. Hãy kiểm tra email ${result.email} để xác minh tài khoản.`,
          );
        },

        error: (error: unknown) => {
          this.localError.set(
            getApiErrorMessage(error),
          );
        },
      });
  }

  private openEmailVerificationStage(
    email: string,
    message: string,
  ): void {
    this.resetChallenge();

    this.auth.clearError();

    this.verificationEmail = email;

    this.localError.set(null);

    this.message.set(message);

    this.stage.set('verify-email');
  }

  private startMfaChallenge(
    challenge: MfaChallengeDetails,
  ): void {
    this.auth.clearError();

    this.localError.set(null);

    this.message.set(null);

    this.mfaTicket =
      challenge.mfaTicket;

    if (challenge.mode === 'verify') {
      this.submitting.set(false);

      this.stage.set('mfa-verify');

      return;
    }

    this.loadEnrollment(
      challenge.mfaTicket,
    );
  }

  private loadEnrollment(
    mfaTicket: string,
  ): void {
    this.submitting.set(true);

    this.auth
      .beginMfaEnrollment(mfaTicket)
      .pipe(
        finalize(() => {
          this.submitting.set(false);
        }),
      )
      .subscribe({
        next: (enrollment) => {
          this.enrollment.set(
            enrollment,
          );

          this.stage.set(
            'mfa-enroll',
          );
        },

        error: (error: unknown) => {
          this.localError.set(
            getApiErrorMessage(error),
          );

          this.resetChallenge();
        },
      });
  }

  private confirmEnrollment(): void {
    const ticket =
      this.mfaTicket;

    const totpCode =
      this.totpCode.trim();

    if (
      !ticket ||
      !/^\d{6}$/.test(totpCode)
    ) {
      this.localError.set(
        'Mã TOTP phải gồm đúng 6 chữ số.',
      );

      return;
    }

    this.localError.set(null);

    this.submitting.set(true);

    this.auth
      .confirmMfaEnrollment({
        mfaTicket: ticket,
        totpCode,
        deviceName: 'TruyenHub Web',
      })
      .pipe(
        finalize(() => {
          this.submitting.set(false);
        }),
      )
      .subscribe({
        next: (result) => {
          this.password = '';

          this.totpCode = '';

          this.recoveryCodes.set(
            result.recoveryCodes,
          );

          if (
            result.recoveryCodes.length >
            0
          ) {
            this.stage.set(
              'recovery-codes',
            );

            return;
          }

          this.closed.emit();
        },

        error: (error: unknown) => {
          this.localError.set(
            getApiErrorMessage(error),
          );
        },
      });
  }

  private verifyMfa(): void {
    const ticket =
      this.mfaTicket;

    if (!ticket) {
      this.localError.set(
        'Phiên xác minh MFA không còn hợp lệ.',
      );

      return;
    }

    const totpCode =
      this.totpCode.trim();

    const recoveryCode =
      this.recoveryCode.trim();

    if (this.useRecoveryCode()) {
      if (!recoveryCode) {
        this.localError.set(
          'Vui lòng nhập mã khôi phục.',
        );

        return;
      }
    } else if (
      !/^\d{6}$/.test(totpCode)
    ) {
      this.localError.set(
        'Mã TOTP phải gồm đúng 6 chữ số.',
      );

      return;
    }

    this.localError.set(null);

    this.submitting.set(true);

    this.auth
      .verifyMfa({
        mfaTicket: ticket,

        ...(this.useRecoveryCode()
          ? {
            recoveryCode,
          }
          : {
            totpCode,
          }),

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

          this.resetChallenge();

          this.closed.emit();
        },

        error: (error: unknown) => {
          this.localError.set(
            getApiErrorMessage(error),
          );
        },
      });
  }

  private startResendCooldown(): void {
    this.stopResendCooldown();

    this.resendCooldownSeconds.set(
      RESEND_VERIFICATION_COOLDOWN_SECONDS,
    );

    this.resendCooldownTimer =
      setInterval(() => {
        const current =
          this.resendCooldownSeconds();

        const next = Math.max(
          0,
          current - 1,
        );

        this.resendCooldownSeconds.set(
          next,
        );

        if (next === 0) {
          this.stopResendCooldown();
        }
      }, 1000);
  }

  private stopResendCooldown(): void {
    if (
      this.resendCooldownTimer !==
      null
    ) {
      clearInterval(
        this.resendCooldownTimer,
      );

      this.resendCooldownTimer = null;
    }

    this.resendCooldownSeconds.set(0);
  }

  private resetChallenge(): void {
    this.stopResendCooldown();

    this.stage.set('credentials');

    this.enrollment.set(null);

    this.useRecoveryCode.set(false);

    this.recoveryCodes.set([]);

    this.verificationEmail = '';

    this.mfaTicket = null;

    this.totpCode = '';

    this.recoveryCode = '';
  }
}

function readApiErrorCode(
  error: unknown,
): string | null {
  if (
    !(error instanceof HttpErrorResponse)
  ) {
    return null;
  }

  const body =
    error.error as
    | Partial<ApiErrorEnvelope>
    | undefined;

  const code =
    body?.error?.code;

  return typeof code === 'string'
    ? code
    : null;
}

function readMfaChallenge(
  error: unknown,
): MfaChallengeDetails | null {
  if (
    !(error instanceof HttpErrorResponse)
  ) {
    return null;
  }

  const body =
    error.error as
    | Partial<ApiErrorEnvelope>
    | undefined;

  const code =
    body?.error?.code;

  /*
   * Hai code ADMIN cũ được giữ tạm
   * để rollout frontend/backend lệch
   * nhau một version vẫn chạy.
   */
  if (
    code !== 'AUTH_MFA_REQUIRED' &&
    code !==
    'AUTH_MFA_ENROLLMENT_REQUIRED' &&
    code !==
    'AUTH_ADMIN_MFA_REQUIRED' &&
    code !==
    'AUTH_ADMIN_MFA_ENROLLMENT_REQUIRED'
  ) {
    return null;
  }

  const details =
    body?.error?.details;

  const mfaTicket =
    details?.['mfaTicket'];

  const mode =
    details?.['mode'];

  const expiresAt =
    details?.['expiresAt'];

  if (
    typeof mfaTicket !== 'string' ||
    (mode !== 'enroll' &&
      mode !== 'verify') ||
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

function isValidEmail(
  value: string,
): boolean {
  const email = value.trim();

  if (
    !email ||
    email.length > 320
  ) {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    email,
  );
}