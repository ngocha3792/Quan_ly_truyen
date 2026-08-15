import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';

import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { RouterLink } from '@angular/router';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';

import { AccountFormFieldComponent } from '../../../shared/ui/account-form-field/account-form-field.component';

import { AuthFlowCardComponent } from '../../../shared/ui/auth-flow-card/auth-flow-card.component';

import { ForgotPasswordResult, ForgotPasswordStatus } from '../../domain/forgot-password.models';

@Component({
  selector: 'app-forgot-password-card',

  standalone: true,

  imports: [
    ReactiveFormsModule,
    RouterLink,
    IconComponent,

    AccountFormFieldComponent,
    AuthFlowCardComponent,
  ],

  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    @if (status === 'success') {
      <app-auth-flow-card
        icon="mail"
        eyebrow="ĐÃ GỬI EMAIL"
        title="Kiểm tra hộp thư"
        description="Chúng tôi đã gửi liên kết đặt lại mật khẩu đến địa chỉ email của bạn."
        tone="success"
      >
        <div class="email-result">
          <app-icon name="mail" [size]="18" />

          <strong>
            {{ result?.email || initialEmail }}
          </strong>
        </div>

        <div
          class="
            information-box
            information-box--success
          "
        >
          <app-icon name="clock" [size]="18" />

          <span>
            Liên kết có hiệu lực trong
            {{ result?.expiresInMinutes ?? 15 }}
            phút.
          </span>
        </div>

        <div class="action-grid">
          <a class="primary-button" href="mailto:">
            <app-icon name="mail" [size]="17" />

            Mở ứng dụng email
          </a>

          <button class="secondary-button" type="button" (click)="useAnotherEmail.emit()">
            Dùng email khác
          </button>
        </div>

        <button class="text-button" type="button" (click)="retry.emit()">Gửi lại liên kết</button>

        <div authFooter class="auth-footer">
          Không tìm thấy email? Hãy kiểm tra thư mục spam hoặc

          <a routerLink="/cong-dong"> liên hệ hỗ trợ </a>.
        </div>
      </app-auth-flow-card>
    } @else {
      <app-auth-flow-card
        icon="mail"
        eyebrow="KHÔI PHỤC TÀI KHOẢN"
        title="Quên mật khẩu"
        description="Nhập email đã đăng ký để nhận liên kết đặt lại mật khẩu."
      >
        @if (errorMessage) {
          <div
            class="
              information-box
              information-box--error
            "
          >
            <app-icon name="alert-triangle" [size]="18" />

            <span>
              {{ errorMessage }}
            </span>
          </div>
        }

        <form class="auth-form" [formGroup]="form" (ngSubmit)="handleSubmit()">
          <app-account-form-field
            inputId="forgot-password-email"
            label="Email"
            type="email"
            icon="mail"
            autocomplete="email"
            placeholder="example@email.com"
            formControlName="email"
            [error]="emailError"
            (valueChange)="errorCleared.emit()"
          />

          <button
            class="
              primary-button
              primary-button--full
            "
            type="submit"
            [disabled]="status === 'submitting'"
          >
            @if (status === 'submitting') {
              <span class="spinner"></span>

              Đang gửi liên kết...
            } @else {
              <app-icon name="mail" [size]="17" />

              Gửi liên kết đặt lại
            }
          </button>

          <a
            class="back-link"
            routerLink="/"
            [queryParams]="{
              auth: 'login',
            }"
          >
            <app-icon name="chevron-left" [size]="16" />

            Quay lại đăng nhập
          </a>
        </form>

        <div
          authFooter
          class="
            auth-footer
            auth-footer--stacked
          "
        >
          <span>
            Không nhận được email? Kiểm tra thư rác hoặc

            <a routerLink="/cong-dong"> liên hệ hỗ trợ </a>.
          </span>

          <span> Liên kết đặt lại sẽ hết hạn sau 15 phút. </span>
        </div>
      </app-auth-flow-card>
    }
  `,

  styles: `
    .auth-form {
      display: grid;
      gap: 16px;
      text-align: left;
    }

    .information-box,
    .email-result {
      padding: 13px 14px;

      display: flex;

      align-items: center;

      justify-content: center;

      gap: 9px;

      border: 1px solid rgba(139, 151, 181, 0.16);

      border-radius: 9px;

      color: #cbd5e1;

      font-size: 13px;

      background: rgba(5, 10, 21, 0.38);
    }

    .information-box {
      margin-bottom: 16px;

      text-align: left;
    }

    .information-box--error {
      color: #fda4b5;

      border-color: rgba(251, 113, 133, 0.23);

      background: rgba(190, 24, 93, 0.08);
    }

    .information-box--success {
      margin: 13px 0 0;

      color: #86efac;

      border-color: rgba(74, 222, 128, 0.2);

      background: rgba(22, 163, 74, 0.08);
    }

    .email-result {
      color: #e9d5ff;

      font-size: 14px;
    }

    .email-result strong {
      overflow-wrap: anywhere;
    }

    .action-grid {
      margin-top: 18px;

      display: grid;

      grid-template-columns: 1fr 1fr;

      gap: 10px;
    }

    .primary-button,
    .secondary-button {
      min-height: 44px;

      padding: 0 17px;

      display: inline-flex;

      align-items: center;

      justify-content: center;

      gap: 8px;

      border-radius: 8px;

      font: inherit;

      font-size: 13.5px;

      font-weight: 700;

      text-decoration: none;

      cursor: pointer;
    }

    .primary-button {
      border: 0;

      color: #fff;

      background: linear-gradient(135deg, #743cdd, #a451eb);

      box-shadow: 0 9px 22px rgba(105, 40, 190, 0.2);
    }

    .primary-button--full {
      width: 100%;
    }

    .primary-button:disabled {
      opacity: 0.55;

      cursor: not-allowed;
    }

    .secondary-button {
      border: 1px solid rgba(139, 151, 181, 0.24);

      color: #cbd5e1;

      background: rgba(255, 255, 255, 0.02);
    }

    .text-button,
    .back-link {
      display: inline-flex;

      align-items: center;

      justify-content: center;

      gap: 5px;

      border: 0;

      color: #a76af4;

      font: inherit;

      font-size: 12.5px;

      font-weight: 650;

      text-decoration: none;

      cursor: pointer;

      background: transparent;
    }

    .text-button {
      margin-top: 14px;
    }

    .auth-footer {
      margin-top: 24px;

      padding-top: 17px;

      border-top: 1px solid rgba(139, 151, 181, 0.12);

      color: #778196;

      font-size: 11.5px;

      line-height: 1.65;
    }

    .auth-footer--stacked {
      display: grid;

      gap: 5px;
    }

    .auth-footer a {
      color: #a96df2;

      text-decoration: none;
    }

    .spinner {
      width: 15px;
      height: 15px;

      border: 2px solid rgba(255, 255, 255, 0.3);

      border-top-color: #fff;

      border-radius: 50%;

      animation: forgot-spin 700ms linear infinite;
    }

    @keyframes forgot-spin {
      to {
        transform: rotate(360deg);
      }
    }

    @media (max-width: 520px) {
      .action-grid {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class ForgotPasswordCardComponent implements OnChanges {
  private readonly formBuilder = inject(FormBuilder);

  @Input()
  status: ForgotPasswordStatus = 'idle';

  @Input()
  result: ForgotPasswordResult | null = null;

  @Input()
  errorMessage = '';

  @Input()
  initialEmail = '';

  @Output()
  readonly resetRequested = new EventEmitter<string>();

  @Output()
  readonly retry = new EventEmitter<void>();

  @Output()
  readonly useAnotherEmail = new EventEmitter<void>();

  @Output()
  readonly errorCleared = new EventEmitter<void>();

  protected readonly form = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  protected get emailControl() {
    return this.form.controls.email;
  }

  protected get emailError(): string {
    if (!this.emailControl.touched) {
      return '';
    }

    if (this.emailControl.hasError('required')) {
      return 'Vui lòng nhập địa chỉ email.';
    }

    if (this.emailControl.hasError('email')) {
      return 'Địa chỉ email không đúng định dạng.';
    }

    return '';
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialEmail'] && this.initialEmail && !this.emailControl.dirty) {
      this.emailControl.setValue(this.initialEmail, {
        emitEvent: false,
      });
    }
  }

  protected handleSubmit(): void {
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      return;
    }

    this.resetRequested.emit(this.emailControl.value.trim());
  }
}
