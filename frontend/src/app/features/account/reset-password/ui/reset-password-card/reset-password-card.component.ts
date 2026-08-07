import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';

import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';

import { RouterLink } from '@angular/router';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';

import { AccountPasswordInputComponent } from '../../../shared/ui/account-password-input/account-password-input.component';

import { AuthFlowCardComponent } from '../../../shared/ui/auth-flow-card/auth-flow-card.component';

import {
  ResetPasswordConfig,
  ResetPasswordResult,
  ResetPasswordStatus,
  ResetPasswordTokenValidation,
} from '../../domain/reset-password.models';

function passwordsMatchValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const password = control.get('password')?.value;

    const confirmPassword = control.get('confirmPassword')?.value;

    if (!password || !confirmPassword) {
      return null;
    }

    return password === confirmPassword
      ? null
      : {
          passwordMismatch: true,
        };
  };
}

function passwordComplexityValidator(minimumLength: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = String(control.value ?? '');

    const errors: ValidationErrors = {};

    if (value.length < minimumLength) {
      errors['passwordMinimumLength'] = true;
    }

    if (!/[A-Z]/.test(value)) {
      errors['passwordUppercase'] = true;
    }

    if (!/[0-9]/.test(value)) {
      errors['passwordNumber'] = true;
    }

    if (!/[!@#$%^&*(),.?":{}|<>_\-+=/\\[\]';`~]/.test(value)) {
      errors['passwordSpecial'] = true;
    }

    return Object.keys(errors).length > 0 ? errors : null;
  };
}

@Component({
  selector: 'app-reset-password-card',

  standalone: true,

  imports: [
    ReactiveFormsModule,
    RouterLink,

    IconComponent,
    AccountPasswordInputComponent,
    AuthFlowCardComponent,
  ],

  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    @if (status === 'idle' || status === 'validating') {
      <app-auth-flow-card
        icon="lock"
        eyebrow="ĐANG KIỂM TRA LIÊN KẾT"
        title="Đang chuẩn bị biểu mẫu"
        description="TruyenHub đang kiểm tra liên kết đặt lại mật khẩu của bạn."
        [loading]="true"
      >
        <div class="progress-line">
          <span></span>
        </div>
      </app-auth-flow-card>
    }

    @if (status === 'ready' || status === 'submitting' || status === 'error') {
      <app-auth-flow-card
        icon="lock"
        eyebrow="ĐẶT LẠI MẬT KHẨU"
        title="Tạo mật khẩu mới"
        description="Nhập mật khẩu mới cho tài khoản của bạn để hoàn tất quá trình khôi phục."
      >
        @if (tokenValidation?.email) {
          <div class="account-email">
            <span> Tài khoản </span>

            <strong>
              {{ tokenValidation?.email }}
            </strong>
          </div>
        }

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

        <form class="reset-form" [formGroup]="form" (ngSubmit)="handleSubmit()">
          <app-account-password-input
            inputId="reset-password"
            label="Mật khẩu mới"
            icon="lock"
            autocomplete="new-password"
            placeholder="Nhập mật khẩu mới"
            [maxLength]="config.maximumLength"
            formControlName="password"
            [error]="passwordError"
            (valueChange)="errorCleared.emit()"
          />

          <app-account-password-input
            inputId="confirm-password"
            label="Xác nhận mật khẩu"
            icon="check"
            autocomplete="new-password"
            placeholder="Nhập lại mật khẩu mới"
            [maxLength]="config.maximumLength"
            formControlName="confirmPassword"
            [error]="confirmPasswordError"
          />

          <section
            class="
              password-requirements
            "
          >
            <h2>Yêu cầu mật khẩu</h2>

            <div class="requirement-grid">
              <p [class.passed]="hasMinimumLength()">
                <span>
                  {{ hasMinimumLength() ? '✓' : config.minimumLength }}
                </span>

                Tối thiểu
                {{ config.minimumLength }}
                ký tự
              </p>

              <p [class.passed]="hasUppercase()">
                <span>
                  {{ hasUppercase() ? '✓' : 'A' }}
                </span>

                Ít nhất 1 chữ in hoa
              </p>

              <p [class.passed]="hasNumber()">
                <span>
                  {{ hasNumber() ? '✓' : '1' }}
                </span>

                Ít nhất 1 chữ số
              </p>

              <p [class.passed]="hasSpecialCharacter()">
                <span>
                  {{ hasSpecialCharacter() ? '✓' : '#' }}
                </span>

                Ít nhất 1 ký tự đặc biệt
              </p>
            </div>
          </section>

          <div class="action-grid">
            <button class="primary-button" type="submit" [disabled]="status === 'submitting'">
              @if (status === 'submitting') {
                <span class="spinner"></span>

                Đang cập nhật...
              } @else {
                <app-icon name="lock" [size]="17" />

                Cập nhật mật khẩu
              }
            </button>

            <a
              class="secondary-button"
              routerLink="/"
              [queryParams]="{
                auth: 'login',
              }"
            >
              Quay lại đăng nhập
            </a>
          </div>
        </form>

        <div
          authFooter
          class="
            auth-footer
            auth-footer--stacked
          "
        >
          <span>
            Liên kết này sẽ hết hạn sau
            {{ config.tokenExpiresInMinutes }}
            phút.
          </span>

          <span>
            Cần hỗ trợ?

            <a routerLink="/lien-he-ho-tro"> Liên hệ đội ngũ TruyenHub </a>.
          </span>
        </div>
      </app-auth-flow-card>
    }

    @if (status === 'success') {
      <app-auth-flow-card
        icon="check"
        eyebrow="CẬP NHẬT THÀNH CÔNG"
        title="Mật khẩu đã được thay đổi"
        description="Bạn có thể sử dụng mật khẩu mới để đăng nhập vào tài khoản TruyenHub."
        tone="success"
      >
        <div
          class="
            success-information
          "
        >
          <app-icon name="check" [size]="19" />

          <div>
            <small> Tài khoản </small>

            <strong>
              {{ result?.email ?? tokenValidation?.email }}
            </strong>
          </div>
        </div>

        <div class="action-grid">
          <a
            class="primary-button"
            routerLink="/"
            [queryParams]="{
              auth: 'login',
            }"
          >
            Đăng nhập ngay
          </a>

          <a class="secondary-button" routerLink="/"> Về trang chủ </a>
        </div>

        <div authFooter class="auth-footer">
          Vì lý do bảo mật, các phiên đăng nhập cũ có thể cần đăng nhập lại.
        </div>
      </app-auth-flow-card>
    }

    @if (status === 'expired' || status === 'invalid') {
      <app-auth-flow-card
        icon="alert-triangle"
        eyebrow="LIÊN KẾT KHÔNG HỢP LỆ"
        [title]="status === 'expired' ? 'Liên kết đã hết hạn' : 'Không thể đặt lại mật khẩu'"
        [description]="errorMessage"
        tone="danger"
      >
        <div class="action-grid">
          <a class="primary-button" routerLink="/quen-mat-khau"> Yêu cầu liên kết mới </a>

          <button class="secondary-button" type="button" (click)="retryValidation.emit()">
            Thử kiểm tra lại
          </button>
        </div>

        <div authFooter class="auth-footer">
          Cần hỗ trợ?

          <a routerLink="/lien-he-ho-tro"> Liên hệ đội ngũ TruyenHub </a>.
        </div>
      </app-auth-flow-card>
    }
  `,

  styles: `
    .reset-form {
      display: grid;

      gap: 16px;
    }

    .account-email,
    .information-box,
    .success-information {
      margin-bottom: 16px;

      padding: 13px 14px;

      border: 1px solid rgba(139, 151, 181, 0.16);

      border-radius: 9px;

      background: rgba(5, 10, 21, 0.38);
    }

    .account-email {
      display: grid;

      gap: 3px;

      text-align: left;
    }

    .account-email span,
    .success-information small {
      color: #7f899d;

      font-size: 11px;
    }

    .account-email strong,
    .success-information strong {
      color: #e9d5ff;

      font-size: 13.5px;

      overflow-wrap: anywhere;
    }

    .information-box,
    .success-information {
      display: flex;

      align-items: center;

      gap: 10px;

      text-align: left;
    }

    .information-box--error {
      color: #fda4b5;

      border-color: rgba(251, 113, 133, 0.23);

      background: rgba(190, 24, 93, 0.08);
    }

    .success-information {
      color: #4ade80;

      border-color: rgba(74, 222, 128, 0.2);

      background: rgba(22, 163, 74, 0.08);
    }

    .success-information div {
      min-width: 0;

      display: grid;

      gap: 2px;
    }

    .password-requirements {
      padding: 15px;

      border: 1px solid rgba(139, 151, 181, 0.14);

      border-radius: 9px;

      text-align: left;

      background: rgba(5, 10, 21, 0.32);
    }

    .password-requirements h2 {
      margin: 0 0 11px;

      color: #d8d5df;

      font-size: 12.5px;
    }

    .requirement-grid {
      display: grid;

      grid-template-columns: repeat(2, minmax(0, 1fr));

      gap: 8px 12px;
    }

    .requirement-grid p {
      margin: 0;

      display: flex;

      align-items: center;

      gap: 7px;

      color: #7f899d;

      font-size: 11.5px;
    }

    .requirement-grid p > span {
      width: 22px;
      height: 22px;

      display: grid;

      place-items: center;

      flex: 0 0 22px;

      border-radius: 50%;

      color: #a76af4;

      font-size: 10px;

      font-weight: 800;

      background: rgba(126, 34, 206, 0.14);
    }

    .requirement-grid p.passed {
      color: #86efac;
    }

    .requirement-grid p.passed > span {
      color: #4ade80;

      background: rgba(22, 163, 74, 0.12);
    }

    .action-grid {
      margin-top: 2px;

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

      font-size: 13px;

      font-weight: 700;

      text-decoration: none;

      cursor: pointer;
    }

    .primary-button {
      border: 0;

      color: #fff;

      background: linear-gradient(135deg, #743cdd, #a451eb);
    }

    .secondary-button {
      border: 1px solid rgba(139, 151, 181, 0.24);

      color: #cbd5e1;

      background: rgba(255, 255, 255, 0.02);
    }

    .primary-button:disabled,
    .secondary-button:disabled {
      opacity: 0.5;

      cursor: not-allowed;
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

    .progress-line {
      height: 4px;

      overflow: hidden;

      border-radius: 999px;

      background: rgba(139, 151, 181, 0.12);
    }

    .progress-line span {
      display: block;

      width: 42%;
      height: 100%;

      border-radius: inherit;

      background: linear-gradient(90deg, #743cdd, #c084fc);

      animation: reset-progress 1.15s ease-in-out infinite alternate;
    }

    .spinner {
      width: 15px;
      height: 15px;

      border: 2px solid rgba(255, 255, 255, 0.3);

      border-top-color: #fff;

      border-radius: 50%;

      animation: reset-spin 700ms linear infinite;
    }

    @keyframes reset-spin {
      to {
        transform: rotate(360deg);
      }
    }

    @keyframes reset-progress {
      from {
        transform: translateX(0);
      }

      to {
        transform: translateX(135%);
      }
    }

    @media (max-width: 520px) {
      .requirement-grid,
      .action-grid {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class ResetPasswordCardComponent implements OnChanges {
  @Input()
  status: ResetPasswordStatus = 'idle';

  @Input()
  config: ResetPasswordConfig = {
    minimumLength: 8,
    maximumLength: 64,
    tokenExpiresInMinutes: 15,
  };

  @Input()
  tokenValidation: ResetPasswordTokenValidation | null = null;

  @Input()
  result: ResetPasswordResult | null = null;

  @Input()
  errorMessage = '';

  @Output()
  readonly passwordSubmitted = new EventEmitter<string>();

  @Output()
  readonly retryValidation = new EventEmitter<void>();

  @Output()
  readonly errorCleared = new EventEmitter<void>();

  protected readonly form = new FormGroup(
    {
      password: new FormControl('', {
        nonNullable: true,

        validators: [Validators.required, passwordComplexityValidator(8), Validators.maxLength(72)],
      }),

      confirmPassword: new FormControl('', {
        nonNullable: true,

        validators: [Validators.required],
      }),
    },
    {
      validators: passwordsMatchValidator(),
    },
  );

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['config']) {
      this.passwordControl.setValidators([
        Validators.required,

        passwordComplexityValidator(this.config.minimumLength),

        Validators.maxLength(this.config.maximumLength),
      ]);

      this.passwordControl.updateValueAndValidity({
        emitEvent: false,
      });
    }
  }

  protected get passwordControl(): FormControl<string> {
    return this.form.controls.password;
  }

  protected get confirmPasswordControl(): FormControl<string> {
    return this.form.controls.confirmPassword;
  }

  protected get passwordError(): string {
    if (!this.passwordControl.touched) {
      return '';
    }

    if (this.passwordControl.hasError('required')) {
      return 'Vui lòng nhập mật khẩu mới.';
    }

    if (this.passwordControl.invalid) {
      return 'Mật khẩu mới chưa đáp ứng đầy đủ yêu cầu bên dưới.';
    }

    return '';
  }

  protected get confirmPasswordError(): string {
    if (!this.confirmPasswordControl.touched) {
      return '';
    }

    if (this.confirmPasswordControl.hasError('required')) {
      return 'Vui lòng nhập lại mật khẩu.';
    }

    if (this.form.hasError('passwordMismatch')) {
      return 'Mật khẩu xác nhận không khớp.';
    }

    return '';
  }

  protected hasMinimumLength(): boolean {
    return this.passwordControl.value.length >= this.config.minimumLength;
  }

  protected hasUppercase(): boolean {
    return /[A-Z]/.test(this.passwordControl.value);
  }

  protected hasNumber(): boolean {
    return /[0-9]/.test(this.passwordControl.value);
  }

  protected hasSpecialCharacter(): boolean {
    return /[!@#$%^&*(),.?":{}|<>_\-+=/\\[\]';`~]/.test(this.passwordControl.value);
  }

  protected handleSubmit(): void {
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      return;
    }

    this.passwordSubmitted.emit(this.passwordControl.value);
  }
}
