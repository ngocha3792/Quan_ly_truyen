
import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    OnChanges,
    Output,
    signal,
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
import {
    RouterLink,
} from '@angular/router';

import {
    ResetPasswordConfig,
    ResetPasswordResult,
    ResetPasswordStatus,
    ResetPasswordTokenValidation,
} from '../../domain/reset-password.models';

function passwordsMatchValidator():
    ValidatorFn {
    return (
        control: AbstractControl,
    ): ValidationErrors | null => {
        const password =
            control.get('password')?.value;

        const confirmPassword =
            control.get(
                'confirmPassword',
            )?.value;

        if (
            !password ||
            !confirmPassword
        ) {
            return null;
        }

        return password === confirmPassword
            ? null
            : {
                passwordMismatch: true,
            };
    };
}

function passwordComplexityValidator(
    minimumLength: number,
): ValidatorFn {
    return (
        control: AbstractControl,
    ): ValidationErrors | null => {
        const value =
            String(control.value ?? '');

        const errors:
            Record<string, boolean> = {};

        if (
            value.length < minimumLength
        ) {
            errors['passwordMinimumLength'] =
                true;
        }

        if (!/[A-Z]/.test(value)) {
            errors['passwordUppercase'] = true;
        }

        if (!/[0-9]/.test(value)) {
            errors['passwordNumber'] = true;
        }

        if (
            !/[!@#$%^&*(),.?":{}|<>_\-+=/\\[\]';`~]/.test(
                value,
            )
        ) {
            errors['passwordSpecial'] = true;
        }

        return Object.keys(errors).length
            ? errors
            : null;
    };
}

@Component({
    selector: 'app-reset-password-card',
    standalone: true,

    imports: [
        ReactiveFormsModule,
        RouterLink,
    ],

    changeDetection:
        ChangeDetectionStrategy.OnPush,

    template: `
    <section
      class="reset-card"
      [attr.data-status]="status"
    >
      <div
        class="decoration"
        aria-hidden="true"
      >
        <span class="sparkle sparkle--one">
          ✦
        </span>

        <span class="sparkle sparkle--two">
          ✦
        </span>

        <span class="sparkle sparkle--three">
          ✧
        </span>
      </div>

      @if (
        status === 'idle' ||
        status === 'validating'
      ) {
        <div class="status-icon">
          <svg viewBox="0 0 24 24">
            <rect
              x="6"
              y="10"
              width="12"
              height="10"
              rx="2"
            ></rect>

            <path
              d="M9 10V7a3 3 0 0 1 6 0v3"
            ></path>
          </svg>

          <span class="loading-ring"></span>
        </div>

        <span class="status-label">
          ĐANG KIỂM TRA LIÊN KẾT
        </span>

        <h1>Đang chuẩn bị biểu mẫu</h1>

        <p class="description">
          TruyenHub đang kiểm tra liên kết đặt
          lại mật khẩu của bạn.
        </p>

        <div class="loading-line">
          <span></span>
        </div>
      }

      @if (
        status === 'ready' ||
        status === 'submitting' ||
        status === 'error'
      ) {
        <div class="status-icon">
          <svg viewBox="0 0 24 24">
            <rect
              x="6"
              y="10"
              width="12"
              height="10"
              rx="2"
            ></rect>

            <path
              d="M9 10V7a3 3 0 0 1 6 0v3"
            ></path>

            <path d="M12 14v2"></path>
          </svg>
        </div>

        <span class="status-label">
          ĐẶT LẠI MẬT KHẨU
        </span>

        <h1>Tạo mật khẩu mới</h1>

        <p class="description">
          Nhập mật khẩu mới cho tài khoản của
          bạn để hoàn tất quá trình khôi phục.
        </p>

        @if (tokenValidation?.email) {
          <div class="account-email">
            <span>Tài khoản</span>

            <strong>
              {{ tokenValidation?.email }}
            </strong>
          </div>
        }

        @if (errorMessage) {
          <div class="error-message">
            <svg viewBox="0 0 24 24">
              <circle
                cx="12"
                cy="12"
                r="9"
              ></circle>

              <path d="M12 7v6"></path>
              <path d="M12 17h.01"></path>
            </svg>

            <span>
              {{ errorMessage }}
            </span>
          </div>
        }

        <form
          [formGroup]="form"
          (ngSubmit)="handleSubmit()"
        >
          <div class="form-field">
            <label for="reset-password">
              Mật khẩu mới
            </label>

            <div
              class="password-input"
              [class.password-input--invalid]="
                passwordControl.invalid &&
                passwordControl.touched
              "
            >
              <svg viewBox="0 0 24 24">
                <rect
                  x="6"
                  y="10"
                  width="12"
                  height="10"
                  rx="2"
                ></rect>

                <path
                  d="M9 10V7a3 3 0 0 1 6 0v3"
                ></path>
              </svg>

              <input
                id="reset-password"
                [type]="
                  showPassword()
                    ? 'text'
                    : 'password'
                "
                formControlName="password"
                autocomplete="new-password"
                placeholder="Nhập mật khẩu mới"
                [maxlength]="
                  config.maximumLength
                "
                (input)="errorCleared.emit()"
              >

              <button
                type="button"
                [attr.aria-label]="
                  showPassword()
                    ? 'Ẩn mật khẩu'
                    : 'Hiện mật khẩu'
                "
                (click)="
                  showPassword.update(
                    value => !value
                  )
                "
              >
                @if (showPassword()) {
                  <svg viewBox="0 0 24 24">
                    <path
                      d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"
                    ></path>

                    <circle
                      cx="12"
                      cy="12"
                      r="2.5"
                    ></circle>

                    <path d="M4 4l16 16"></path>
                  </svg>
                } @else {
                  <svg viewBox="0 0 24 24">
                    <path
                      d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"
                    ></path>

                    <circle
                      cx="12"
                      cy="12"
                      r="2.5"
                    ></circle>
                  </svg>
                }
              </button>
            </div>

            @if (
              passwordControl.touched &&
              passwordControl.hasError(
                'required'
              )
            ) {
              <small class="field-error">
                Vui lòng nhập mật khẩu mới.
              </small>
            }
          </div>

          <div class="form-field">
            <label for="confirm-password">
              Xác nhận mật khẩu
            </label>

            <div
              class="password-input"
              [class.password-input--invalid]="
                confirmPasswordControl.touched &&
                (
                  confirmPasswordControl.invalid ||
                  form.hasError(
                    'passwordMismatch'
                  )
                )
              "
            >
              <svg viewBox="0 0 24 24">
                <rect
                  x="6"
                  y="10"
                  width="12"
                  height="10"
                  rx="2"
                ></rect>

                <path
                  d="M9 10V7a3 3 0 0 1 6 0v3"
                ></path>
              </svg>

              <input
                id="confirm-password"
                [type]="
                  showConfirmPassword()
                    ? 'text'
                    : 'password'
                "
                formControlName="confirmPassword"
                autocomplete="new-password"
                placeholder="Nhập lại mật khẩu mới"
                [maxlength]="
                  config.maximumLength
                "
              >

              <button
                type="button"
                [attr.aria-label]="
                  showConfirmPassword()
                    ? 'Ẩn mật khẩu xác nhận'
                    : 'Hiện mật khẩu xác nhận'
                "
                (click)="
                  showConfirmPassword.update(
                    value => !value
                  )
                "
              >
                @if (
                  showConfirmPassword()
                ) {
                  <svg viewBox="0 0 24 24">
                    <path
                      d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"
                    ></path>

                    <circle
                      cx="12"
                      cy="12"
                      r="2.5"
                    ></circle>

                    <path d="M4 4l16 16"></path>
                  </svg>
                } @else {
                  <svg viewBox="0 0 24 24">
                    <path
                      d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"
                    ></path>

                    <circle
                      cx="12"
                      cy="12"
                      r="2.5"
                    ></circle>
                  </svg>
                }
              </button>
            </div>

            @if (
              confirmPasswordControl.touched &&
              confirmPasswordControl.hasError(
                'required'
              )
            ) {
              <small class="field-error">
                Vui lòng nhập lại mật khẩu.
              </small>
            }

            @if (
              confirmPasswordControl.touched &&
              form.hasError(
                'passwordMismatch'
              )
            ) {
              <small class="field-error">
                Mật khẩu xác nhận không khớp.
              </small>
            }
          </div>

          <section class="password-requirements">
            <h2>Yêu cầu mật khẩu</h2>

            <div class="requirement-grid">
              <p
                [class.requirement--passed]="
                  hasMinimumLength()
                "
              >
                <span>
                  @if (hasMinimumLength()) {
                    ✓
                  } @else {
                    8
                  }
                </span>

                Tối thiểu
                {{ config.minimumLength }}
                ký tự
              </p>

              <p
                [class.requirement--passed]="
                  hasUppercase()
                "
              >
                <span>
                  @if (hasUppercase()) {
                    ✓
                  } @else {
                    A
                  }
                </span>

                Ít nhất 1 chữ in hoa
              </p>

              <p
                [class.requirement--passed]="
                  hasNumber()
                "
              >
                <span>
                  @if (hasNumber()) {
                    ✓
                  } @else {
                    1
                  }
                </span>

                Ít nhất 1 chữ số
              </p>

              <p
                [class.requirement--passed]="
                  hasSpecialCharacter()
                "
              >
                <span>
                  @if (
                    hasSpecialCharacter()
                  ) {
                    ✓
                  } @else {
                    #
                  }
                </span>

                Ít nhất 1 ký tự đặc biệt
              </p>
            </div>
          </section>

          <div class="form-actions">
            <button
              class="submit-button"
              type="submit"
              [disabled]="
                status === 'submitting'
              "
            >
              @if (
                status === 'submitting'
              ) {
                <span class="spinner"></span>

                Đang cập nhật...
              } @else {
                <svg viewBox="0 0 24 24">
                  <rect
                    x="6"
                    y="10"
                    width="12"
                    height="10"
                    rx="2"
                  ></rect>

                  <path
                    d="M9 10V7a3 3 0 0 1 6 0v3"
                  ></path>
                </svg>

                Cập nhật mật khẩu
              }
            </button>

            <a
              class="secondary-button"
              routerLink="/"
              [queryParams]="{
                auth: 'login'
              }"
            >
              Quay lại đăng nhập
            </a>
          </div>
        </form>

        <footer class="card-footer">
          <p>
            <svg viewBox="0 0 24 24">
              <circle
                cx="12"
                cy="12"
                r="9"
              ></circle>

              <path d="M12 7v5l3 2"></path>
            </svg>

            Liên kết này sẽ hết hạn sau
            {{ config.tokenExpiresInMinutes }}
            phút.
          </p>

          <p>
            <svg viewBox="0 0 24 24">
              <path
                d="M4 13v-2a8 8 0 0 1 16 0v2"
              ></path>

              <path
                d="M4 13a2 2 0 0 1 2-2h1v6H6a2 2 0 0 1-2-2v-2Z"
              ></path>
            </svg>

            Cần hỗ trợ?

            <a routerLink="/lien-he-ho-tro">
              Liên hệ đội ngũ TruyenHub
            </a>
          </p>
        </footer>
      }

      @if (status === 'success') {
        <div class="status-icon status-icon--success">
          <svg viewBox="0 0 24 24">
            <rect
              x="6"
              y="10"
              width="12"
              height="10"
              rx="2"
            ></rect>

            <path
              d="M9 10V7a3 3 0 0 1 6 0v3"
            ></path>

            <circle
              cx="17"
              cy="17"
              r="5"
            ></circle>

            <path
              d="m15 17 1.4 1.4L19 15.8"
            ></path>
          </svg>
        </div>

        <span class="status-label status-label--success">
          CẬP NHẬT THÀNH CÔNG
        </span>

        <h1>Mật khẩu đã được thay đổi</h1>

        <p class="description">
          Bạn có thể sử dụng mật khẩu mới để
          đăng nhập vào tài khoản TruyenHub.
        </p>

        <div class="success-information">
          <svg viewBox="0 0 24 24">
            <circle
              cx="12"
              cy="12"
              r="9"
            ></circle>

            <path
              d="m8 12 2.5 2.5L16 9"
            ></path>
          </svg>

          <div>
            <small>Tài khoản</small>

            <strong>
              {{
                result?.email ??
                tokenValidation?.email
              }}
            </strong>
          </div>
        </div>

        <div class="success-actions">
          <a
            class="submit-button"
            routerLink="/"
            [queryParams]="{
              auth: 'login'
            }"
          >
            Đăng nhập ngay
          </a>

          <a
            class="secondary-button"
            routerLink="/"
          >
            Về trang chủ
          </a>
        </div>

        <footer class="card-footer">
          <p>
            Vì lý do bảo mật, tất cả phiên đăng
            nhập cũ có thể cần đăng nhập lại.
          </p>
        </footer>
      }

      @if (
        status === 'expired' ||
        status === 'invalid'
      ) {
        <div class="status-icon status-icon--error">
          <svg viewBox="0 0 24 24">
            <circle
              cx="12"
              cy="12"
              r="9"
            ></circle>

            <path d="M9 9l6 6"></path>
            <path d="m15 9-6 6"></path>
          </svg>
        </div>

        <span class="status-label status-label--error">
          LIÊN KẾT KHÔNG HỢP LỆ
        </span>

        <h1>
          {{
            status === 'expired'
              ? 'Liên kết đã hết hạn'
              : 'Không thể đặt lại mật khẩu'
          }}
        </h1>

        <p class="description">
          {{ errorMessage }}
        </p>

        <div class="invalid-actions">
          <a
            class="submit-button"
            routerLink="/quen-mat-khau"
          >
            Yêu cầu liên kết mới
          </a>

          <a
            class="secondary-button"
            routerLink="/"
          >
            Quay lại trang chủ
          </a>
        </div>

        <footer class="card-footer">
          <p>
            Cần hỗ trợ?

            <a routerLink="/lien-he-ho-tro">
              Liên hệ đội ngũ TruyenHub
            </a>
          </p>
        </footer>
      }
    </section>
  `,

    styles: [`
    :host {
      display: block;
      width: 100%;
    }

    .reset-card {
      position: relative;
      width: min(650px, 100%);
      min-height: auto;
      margin: 0 auto;
      overflow: hidden;
      padding: 40px 56px 36px;

      border: 1px solid var(--border);
      border-radius: 16px;

      background:
        radial-gradient(
          circle at 50% 8%,
          rgba(126, 34, 206, 0.17),
          transparent 31%
        ),
        linear-gradient(
          145deg,
          rgba(16, 22, 39, 0.96),
          rgba(9, 15, 29, 0.98)
        );

      box-shadow:
        0 28px 75px rgba(0, 0, 0, 0.23),
        inset 0 1px 0
          rgba(255, 255, 255, 0.018);

      color: var(--text-strong);
      text-align: center;
      isolation: isolate;
    }

    .reset-card::before {
      position: absolute;
      top: -190px;
      left: 50%;
      z-index: -1;

      width: 470px;
      height: 330px;

      border-radius: 50%;
      content: "";

      background:
        rgba(126, 34, 206, 0.15);

      filter: blur(78px);
      transform: translateX(-50%);
    }

    .decoration {
      position: absolute;
      top: 38px;
      left: 50%;

      width: 310px;
      height: 105px;

      pointer-events: none;
      transform: translateX(-50%);
    }

    .sparkle {
      position: absolute;
      color: rgba(192, 132, 252, 0.8);

      text-shadow:
        0 0 12px
        rgba(168, 85, 247, 0.8);
    }

    .sparkle--one {
      top: 26px;
      left: 20px;
      font-size: 13px;
    }

    .sparkle--two {
      top: 15px;
      right: 18px;
      font-size: 11px;
    }

    .sparkle--three {
      right: 47px;
      bottom: 12px;
      font-size: 13px;
    }

    .status-icon {
      position: relative;

      display: grid;
      width: 96px;
      height: 96px;

      margin: 0 auto 20px;
      place-items: center;

      border:
        1px solid
        rgba(192, 132, 252, 0.34);

      border-radius: 50%;

      background:
        radial-gradient(
          circle,
          rgba(147, 51, 234, 0.42),
          rgba(76, 29, 149, 0.1) 68%
        );

      color: #c084fc;

      box-shadow:
        0 0 36px
          rgba(168, 85, 247, 0.2),
        inset 0 0 20px
          rgba(168, 85, 247, 0.08);
    }

    .status-icon svg {
      width: 58px;
      height: 58px;
    }

    .status-icon--success {
      border-color:
        rgba(74, 222, 128, 0.34);

      background:
        radial-gradient(
          circle,
          rgba(22, 163, 74, 0.3),
          rgba(5, 46, 22, 0.08) 68%
        );

      color: #4ade80;
    }

    .status-icon--error {
      border-color:
        rgba(251, 113, 133, 0.34);

      background:
        radial-gradient(
          circle,
          rgba(190, 18, 60, 0.28),
          rgba(76, 5, 25, 0.08) 68%
        );

      color: #fb7185;
    }

    .status-label {
      display: inline-flex;
      min-height: 30px;
      align-items: center;
      justify-content: center;

      margin-bottom: 14px;
      padding: 5px 16px;

      border:
        1px solid
        rgba(192, 132, 252, 0.34);

      border-radius: 999px;

      background:
        rgba(126, 34, 206, 0.2);

      color: #d8b4fe;
      font-size: 11.5px;
      font-weight: 800;
      letter-spacing: 0.065em;
    }

    .status-label--success {
      border-color:
        rgba(74, 222, 128, 0.26);

      background:
        rgba(22, 163, 74, 0.1);

      color: #86efac;
    }

    .status-label--error {
      border-color:
        rgba(251, 113, 133, 0.27);

      background:
        rgba(190, 18, 60, 0.12);

      color: #fda4af;
    }

    h1 {
      margin: 0;

      color: #f8f6fb;
      font-size: clamp(1.75rem, 3vw, 2.2rem);
      line-height: 1.2;
      letter-spacing: -1px;
    }

    .description {
      margin: 12px auto 22px;

      color: var(--text-secondary);
      font-size: 14.5px;
      line-height: 1.6;
    }

    .account-email {
      display: flex;
      min-height: 36px;
      align-items: center;
      justify-content: center;
      gap: 8px;

      margin: -6px 0 16px;

      color: var(--text-muted);
      font-size: 13px;
    }

    .account-email strong {
      color: #c084fc;
      font-weight: 700;
    }

    form {
      display: grid;
      gap: 14px;
      text-align: left;
    }

    .form-field {
      display: grid;
      gap: 7px;
    }

    .form-field label {
      color: var(--text-strong);
      font-size: 13.5px;
      font-weight: 650;
    }

    .password-input {
      display: grid;
      min-height: 52px;

      grid-template-columns:
        24px
        minmax(0, 1fr)
        36px;

      align-items: center;
      gap: 12px;

      padding: 0 12px 0 16px;

      border: 1px solid var(--border);

      border-radius: 9px;

      background:
        rgba(7, 13, 27, 0.72);

      transition:
        border-color 140ms ease,
        box-shadow 140ms ease;
    }

    .password-input:focus-within {
      border-color:
        rgba(192, 132, 252, 0.7);

      box-shadow:
        0 0 0 3px
          rgba(168, 85, 247, 0.12),
        0 0 20px
          rgba(168, 85, 247, 0.07);
    }

    .password-input--invalid {
      border-color:
        rgba(251, 113, 133, 0.55);
    }

    .password-input > svg {
      width: 21px;
      height: 21px;
      color: var(--text-muted);
    }

    .password-input input {
      width: 100%;
      height: 50px;

      border: 0;
      outline: none;

      background: transparent;
      color: var(--text-strong);

      font: inherit;
      font-size: 14px;
    }

    .password-input input::placeholder {
      color: var(--text-muted);
    }

    .password-input button {
      display: grid;
      width: 36px;
      height: 36px;
      place-items: center;

      border: 0;
      border-radius: 6px;

      background: transparent;
      color: var(--text-muted);

      cursor: pointer;
    }

    .password-input button:hover {
      background:
        rgba(126, 34, 206, 0.12);

      color: #c084fc;
    }

    .password-input button svg {
      width: 20px;
      height: 20px;
    }

    .field-error {
      color: #fb7185;
      font-size: 12px;
    }

    .password-requirements {
      padding: 14px 18px;

      border: 1px solid var(--border);

      border-radius: 10px;

      background:
        linear-gradient(
          145deg,
          rgba(18, 25, 46, 0.83),
          rgba(11, 17, 33, 0.83)
        );
    }

    .password-requirements h2 {
      margin: 0 0 12px;

      color: #c084fc;
      font-size: 13.5px;
      font-weight: 700;
    }

    .requirement-grid {
      display: grid;
      grid-template-columns:
        repeat(2, minmax(0, 1fr));

      gap: 10px 18px;
    }

    .requirement-grid p {
      display: flex;
      align-items: center;
      gap: 8px;

      margin: 0;

      color: var(--text-secondary);
      font-size: 12.5px;
    }

    .requirement-grid p > span {
      display: grid;
      width: 20px;
      height: 20px;
      flex: 0 0 auto;
      place-items: center;

      border:
        1px solid
        rgba(192, 132, 252, 0.55);

      border-radius: 50%;

      color: #c084fc;
      font-size: 10px;
      font-weight: 800;
    }

    .requirement-grid
      .requirement--passed {
      color: #86efac;
    }

    .requirement-grid
      .requirement--passed
      > span {
      border-color:
        rgba(74, 222, 128, 0.5);

      background:
        rgba(22, 163, 74, 0.12);

      color: #4ade80;
    }

    .form-actions,
    .success-actions,
    .invalid-actions {
      display: grid;
      grid-template-columns:
        repeat(2, minmax(0, 1fr));

      gap: 12px;
    }

    .submit-button,
    .secondary-button {
      display: inline-flex;
      min-height: 48px;
      align-items: center;
      justify-content: center;
      gap: 10px;

      padding: 11px 18px;
      border-radius: 9px;

      font: inherit;
      font-size: 14px;
      font-weight: 700;
      text-decoration: none;
      cursor: pointer;
    }

    .submit-button {
      border:
        1px solid
        rgba(216, 180, 254, 0.25);

      background:
        linear-gradient(
          135deg,
          #a855f7,
          #7c3aed
        );

      color: #ffffff;

      box-shadow:
        0 9px 27px
          rgba(126, 34, 206, 0.28),
        inset 0 1px 0
          rgba(255, 255, 255, 0.13);
    }

    .submit-button:hover:not(:disabled) {
      background:
        linear-gradient(
          135deg,
          #b967ff,
          #8b5cf6
        );
    }

    .submit-button:disabled {
      opacity: 0.62;
      cursor: not-allowed;
    }

    .submit-button svg {
      width: 20px;
      height: 20px;
    }

    .secondary-button {
      border: 1px solid rgba(139, 151, 190, 0.25);

      background:
        rgba(8, 14, 28, 0.58);

      color: #f3f0f8;
    }

    .secondary-button:hover {
      border-color:
        rgba(192, 132, 252, 0.38);

      color: #d8b4fe;
    }

    .error-message {
      display: flex;
      align-items: flex-start;
      gap: 10px;

      margin-bottom: 14px;
      padding: 12px 14px;

      border:
        1px solid
        rgba(251, 113, 133, 0.24);

      border-radius: 8px;

      background:
        rgba(190, 18, 60, 0.09);

      color: #fda4af;
      font-size: 13.5px;
      line-height: 1.5;
      text-align: left;
    }

    .error-message svg {
      width: 20px;
      height: 20px;
      flex: 0 0 auto;
    }

    .card-footer {
      display: grid;
      gap: 12px;

      margin-top: 22px;
      padding-top: 18px;

      border-top: 1px solid var(--border);
    }

    .card-footer p {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;

      margin: 0;

      color: var(--text-secondary);
      font-size: 13.5px;
      line-height: 1.5;
    }

    .card-footer svg {
      width: 17px;
      height: 17px;
      flex: 0 0 auto;
    }

    .card-footer a {
      color: #b967ff;
      font-weight: 650;
      text-decoration: none;
    }

    .card-footer a:hover {
      color: #d8b4fe;
    }

    .success-information {
      display: flex;
      min-height: 76px;
      align-items: center;
      gap: 14px;

      margin: 22px 0;
      padding: 14px 18px;

      border:
        1px solid
        rgba(74, 222, 128, 0.2);

      border-radius: 12px;

      background:
        rgba(22, 163, 74, 0.07);

      text-align: left;
    }

    .success-information > svg {
      width: 36px;
      height: 36px;
      flex: 0 0 auto;
      color: #4ade80;
    }

    .success-information div {
      display: grid;
      gap: 4px;
    }

    .success-information small {
      color: var(--text-muted);
      font-size: 12px;
    }

    .success-information strong {
      color: var(--text-strong);
      font-size: 15px;
      font-weight: 700;
    }

    .spinner {
      width: 18px;
      height: 18px;

      border:
        2px solid
        rgba(255, 255, 255, 0.35);

      border-top-color: #ffffff;
      border-radius: 50%;

      animation:
        reset-password-spin
        0.75s linear infinite;
    }

    .loading-ring {
      position: absolute;
      inset: -1px;

      border: 2px solid transparent;
      border-top-color: #c084fc;
      border-right-color:
        rgba(192, 132, 252, 0.25);

      border-radius: 50%;

      animation:
        reset-password-spin
        1s linear infinite;
    }

    .loading-line {
      height: 6px;
      margin: 32px auto 18px;
      overflow: hidden;

      border-radius: 999px;

      background:
        rgba(105, 116, 145, 0.22);
    }

    .loading-line span {
      display: block;
      width: 38%;
      height: 100%;

      border-radius: inherit;

      background:
        linear-gradient(
          90deg,
          transparent,
          #a855f7,
          #c084fc,
          transparent
        );

      animation:
        reset-password-progress
        1.35s ease-in-out infinite;
    }

    .reset-card svg {
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    @keyframes reset-password-spin {
      to {
        transform: rotate(360deg);
      }
    }

    @keyframes reset-password-progress {
      from {
        transform: translateX(-120%);
      }

      to {
        transform: translateX(360%);
      }
    }

    @media (max-width: 620px) {
      .reset-card {
        padding: 30px 20px 24px;
      }

      .status-icon {
        width: 84px;
        height: 84px;
      }

      .status-icon svg {
        width: 50px;
        height: 50px;
      }

      .requirement-grid,
      .form-actions,
      .success-actions,
      .invalid-actions {
        grid-template-columns: 1fr;
      }

      .card-footer p {
        flex-wrap: wrap;
      }
    }
  `],
})
export class ResetPasswordCardComponent
    implements OnChanges {
    @Input()
    status: ResetPasswordStatus = 'idle';

    @Input()
    config: ResetPasswordConfig = {
        minimumLength: 8,
        maximumLength: 64,
        tokenExpiresInMinutes: 15,
    };

    @Input()
    tokenValidation:
        ResetPasswordTokenValidation | null =
        null;

    @Input()
    result: ResetPasswordResult | null =
        null;

    @Input()
    errorMessage = '';

    @Output()
    readonly passwordSubmitted =
        new EventEmitter<string>();

    @Output()
    readonly retryValidation =
        new EventEmitter<void>();

    @Output()
    readonly errorCleared =
        new EventEmitter<void>();

    protected readonly showPassword =
        signal(false);

    protected readonly showConfirmPassword =
        signal(false);

    protected readonly form =
        new FormGroup(
            {
                password:
                    new FormControl(
                        '',
                        {
                            nonNullable: true,

                            validators: [
                                Validators.required,

                                passwordComplexityValidator(
                                    8,
                                ),

                                Validators.maxLength(
                                    64,
                                ),
                            ],
                        },
                    ),

                confirmPassword:
                    new FormControl(
                        '',
                        {
                            nonNullable: true,

                            validators: [
                                Validators.required,
                            ],
                        },
                    ),
            },

            {
                validators:
                    passwordsMatchValidator(),
            },
        );

    ngOnChanges(
        changes: SimpleChanges,
    ): void {
        if (changes['config']) {
            this.passwordControl.setValidators([
                Validators.required,

                passwordComplexityValidator(
                    this.config.minimumLength,
                ),

                Validators.maxLength(
                    this.config.maximumLength,
                ),
            ]);

            this.passwordControl
                .updateValueAndValidity({
                    emitEvent: false,
                });
        }
    }

    protected get passwordControl():
        FormControl<string> {
        return this.form.controls.password;
    }

    protected get confirmPasswordControl():
        FormControl<string> {
        return this.form.controls
            .confirmPassword;
    }

    protected hasMinimumLength(): boolean {
        return (
            this.passwordControl.value.length >=
            this.config.minimumLength
        );
    }

    protected hasUppercase(): boolean {
        return /[A-Z]/.test(
            this.passwordControl.value,
        );
    }

    protected hasNumber(): boolean {
        return /[0-9]/.test(
            this.passwordControl.value,
        );
    }

    protected hasSpecialCharacter(): boolean {
        return /[!@#$%^&*(),.?":{}|<>_\-+=/\\[\]';`~]/.test(
            this.passwordControl.value,
        );
    }

    protected handleSubmit(): void {
        this.form.markAllAsTouched();

        if (this.form.invalid) {
            return;
        }

        this.passwordSubmitted.emit(
            this.passwordControl.value,
        );
    }
}