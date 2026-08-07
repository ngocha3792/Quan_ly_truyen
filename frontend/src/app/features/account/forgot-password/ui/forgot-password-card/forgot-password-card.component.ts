
import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    inject,
    Input,
    Output,
} from '@angular/core';
import {
    FormBuilder,
    ReactiveFormsModule,
    Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';

import {
    ForgotPasswordResult,
    ForgotPasswordStatus,
} from '../../domain/forgot-password.models';

@Component({
    selector: 'app-forgot-password-card',
    standalone: true,

    imports: [
        ReactiveFormsModule,
        RouterLink,
    ],

    changeDetection:
        ChangeDetectionStrategy.OnPush,

    template: `
    <section class="forgot-card">
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

      @if (status !== 'success') {
        <div class="status-icon">
          <svg viewBox="0 0 24 24">
            <rect
              x="3"
              y="5"
              width="18"
              height="14"
              rx="2"
            ></rect>

            <path d="m3 7 9 6 9-6"></path>
          </svg>
        </div>

        <span class="status-label">
          KHÔI PHỤC TÀI KHOẢN
        </span>

        <h1>Quên mật khẩu</h1>

        <p class="description">
          Nhập email đã đăng ký để nhận liên kết
          đặt lại mật khẩu.
        </p>

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
            <label for="forgot-password-email">
              Email
            </label>

            <div
              class="input-wrap"
              [class.input-wrap--invalid]="
                emailControl.invalid &&
                emailControl.touched
              "
            >
              <svg viewBox="0 0 24 24">
                <rect
                  x="3"
                  y="5"
                  width="18"
                  height="14"
                  rx="2"
                ></rect>

                <path d="m3 7 9 6 9-6"></path>
              </svg>

              <input
                id="forgot-password-email"
                type="email"
                formControlName="email"
                autocomplete="email"
                placeholder="example@email.com"
                (input)="errorCleared.emit()"
              >
            </div>

            @if (
              emailControl.touched &&
              emailControl.hasError('required')
            ) {
              <small class="field-error">
                Vui lòng nhập địa chỉ email.
              </small>
            }

            @if (
              emailControl.touched &&
              emailControl.hasError('email')
            ) {
              <small class="field-error">
                Địa chỉ email không đúng định dạng.
              </small>
            }
          </div>

          <button
            class="submit-button"
            type="submit"
            [disabled]="status === 'submitting'"
          >
            @if (status === 'submitting') {
              <span class="spinner"></span>

              Đang gửi liên kết...
            } @else {
              <svg viewBox="0 0 24 24">
                <path
                  d="m22 2-7 20-4-9-9-4 20-7Z"
                ></path>

                <path d="M22 2 11 13"></path>
              </svg>

              Gửi liên kết đặt lại
            }
          </button>

          <a
            class="login-link"
            routerLink="/"
            [queryParams]="{
              auth: 'login'
            }"
          >
            <svg viewBox="0 0 24 24">
              <path d="M19 12H5"></path>
              <path d="m11 18-6-6 6-6"></path>
            </svg>

            Quay lại đăng nhập
          </a>
        </form>

        <footer class="card-footer">
          <p>
            <svg viewBox="0 0 24 24">
              <rect
                x="3"
                y="5"
                width="18"
                height="14"
                rx="2"
              ></rect>

              <path d="m3 7 9 6 9-6"></path>
            </svg>

            Không nhận được email? Kiểm tra thư rác
            hoặc

            <a routerLink="/lien-he-ho-tro">
              Liên hệ hỗ trợ
            </a>
          </p>

          <p>
            <svg viewBox="0 0 24 24">
              <circle
                cx="12"
                cy="12"
                r="9"
              ></circle>

              <path d="M12 7v5l3 2"></path>
            </svg>

            Liên kết đặt lại sẽ hết hạn sau
            15 phút.
          </p>
        </footer>
      } @else {
        <div class="status-icon status-icon--success">
          <svg viewBox="0 0 24 24">
            <rect
              x="3"
              y="5"
              width="18"
              height="14"
              rx="2"
            ></rect>

            <path d="m3 7 9 6 9-6"></path>

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
          ĐÃ GỬI EMAIL
        </span>

        <h1>Kiểm tra hộp thư</h1>

        <p class="description">
          Chúng tôi đã gửi liên kết đặt lại mật
          khẩu đến địa chỉ email:
        </p>

        <div class="email-result">
          <svg viewBox="0 0 24 24">
            <rect
              x="3"
              y="5"
              width="18"
              height="14"
              rx="2"
            ></rect>

            <path d="m3 7 9 6 9-6"></path>
          </svg>

          <strong>
            {{ result?.email }}
          </strong>
        </div>

        <div class="success-note">
          <svg viewBox="0 0 24 24">
            <circle
              cx="12"
              cy="12"
              r="9"
            ></circle>

            <path d="M12 7v5l3 2"></path>
          </svg>

          <span>
            Liên kết có hiệu lực trong
            {{ result?.expiresInMinutes ?? 15 }}
            phút.
          </span>
        </div>

        <div class="success-actions">
          <a
            class="primary-action"
            href="mailto:"
          >
            <svg viewBox="0 0 24 24">
              <rect
                x="3"
                y="5"
                width="18"
                height="14"
                rx="2"
              ></rect>

              <path d="m3 7 9 6 9-6"></path>
            </svg>

            Mở ứng dụng email
          </a>

          <button
            class="secondary-action"
            type="button"
            (click)="useAnotherEmail.emit()"
          >
            Dùng email khác
          </button>
        </div>

        <button
          class="resend-button"
          type="button"
          (click)="retry.emit()"
        >
          <svg viewBox="0 0 24 24">
            <path
              d="M3 12a9 9 0 1 0 3-6.7"
            ></path>

            <path d="M3 4v6h6"></path>
          </svg>

          Gửi lại liên kết
        </button>

        <footer class="card-footer">
          <p>
            Không tìm thấy email? Hãy kiểm tra
            thư mục spam hoặc

            <a routerLink="/lien-he-ho-tro">
              liên hệ hỗ trợ
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

    .forgot-card {
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
          circle at 50% 10%,
          rgba(126, 34, 206, 0.16),
          transparent 31%
        ),
        linear-gradient(
          145deg,
          rgba(16, 22, 39, 0.96),
          rgba(9, 15, 29, 0.98)
        );
      box-shadow:
        0 28px 75px rgba(0, 0, 0, 0.23),
        inset 0 1px 0 rgba(255, 255, 255, 0.018);
      text-align: center;
      isolation: isolate;
    }

    .forgot-card::before {
      position: absolute;
      top: -190px;
      left: 50%;
      z-index: -1;
      width: 470px;
      height: 330px;
      border-radius: 50%;
      content: "";
      background: rgba(126, 34, 206, 0.14);
      filter: blur(78px);
      transform: translateX(-50%);
    }

    .decoration {
      position: absolute;
      top: 40px;
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
        0 0 12px rgba(168, 85, 247, 0.8);
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
      border: 1px solid rgba(192, 132, 252, 0.34);
      border-radius: 50%;
      background:
        radial-gradient(
          circle,
          rgba(147, 51, 234, 0.42),
          rgba(76, 29, 149, 0.1) 68%
        );
      color: #c084fc;
      box-shadow:
        0 0 36px rgba(168, 85, 247, 0.2),
        inset 0 0 20px rgba(168, 85, 247, 0.08);
    }

    .status-icon svg {
      width: 58px;
      height: 58px;
    }

    .status-icon--success {
      border-color: rgba(74, 222, 128, 0.34);
      background:
        radial-gradient(
          circle,
          rgba(22, 163, 74, 0.3),
          rgba(5, 46, 22, 0.08) 68%
        );
      color: #4ade80;
    }

    .status-label {
      display: inline-flex;
      min-height: 30px;
      align-items: center;
      justify-content: center;
      margin-bottom: 14px;
      padding: 5px 16px;
      border: 1px solid rgba(192, 132, 252, 0.34);
      border-radius: 999px;
      background: rgba(126, 34, 206, 0.2);
      color: #d8b4fe;
      font-size: 11.5px;
      font-weight: 800;
      letter-spacing: 0.065em;
    }

    .status-label--success {
      border-color: rgba(74, 222, 128, 0.26);
      background: rgba(22, 163, 74, 0.1);
      color: #86efac;
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

    .input-wrap {
      display: grid;
      min-height: 52px;
      grid-template-columns: 24px minmax(0, 1fr);
      align-items: center;
      gap: 12px;
      padding: 0 16px;
      border: 1px solid var(--border);
      border-radius: 9px;
      background: rgba(7, 13, 27, 0.72);
      transition:
        border-color 140ms ease,
        box-shadow 140ms ease;
    }

    .input-wrap:focus-within {
      border-color: rgba(192, 132, 252, 0.7);
      box-shadow:
        0 0 0 3px rgba(168, 85, 247, 0.12),
        0 0 20px rgba(168, 85, 247, 0.07);
    }

    .input-wrap--invalid {
      border-color: rgba(251, 113, 133, 0.55);
    }

    .input-wrap svg {
      width: 21px;
      height: 21px;
      color: var(--text-muted);
    }

    .input-wrap input {
      width: 100%;
      height: 50px;
      border: 0;
      outline: none;
      background: transparent;
      color: var(--text-strong);
      font: inherit;
      font-size: 14px;
    }

    .input-wrap input::placeholder {
      color: var(--text-muted);
    }

    .field-error {
      color: #fb7185;
      font-size: 12px;
    }

    .submit-button,
    .login-link,
    .primary-action,
    .secondary-action {
      display: inline-flex;
      min-height: 48px;
      align-items: center;
      justify-content: center;
      gap: 10px;
      border-radius: 9px;
      font: inherit;
      font-size: 14px;
      font-weight: 700;
      text-decoration: none;
    }

    .submit-button,
    .primary-action {
      border: 1px solid rgba(216, 180, 254, 0.25);
      background:
        linear-gradient(
          135deg,
          #a855f7,
          #7c3aed
        );
      color: #ffffff;
      box-shadow:
        0 9px 27px rgba(126, 34, 206, 0.28),
        inset 0 1px 0 rgba(255, 255, 255, 0.13);
      cursor: pointer;
    }

    .submit-button:hover:not(:disabled),
    .primary-action:hover {
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

    .submit-button svg,
    .login-link svg,
    .primary-action svg {
      width: 20px;
      height: 20px;
    }

    .login-link,
    .secondary-action {
      border: 1px solid rgba(139, 151, 190, 0.25);
      background: rgba(8, 14, 28, 0.58);
      color: #f3f0f8;
      cursor: pointer;
    }

    .login-link:hover,
    .secondary-action:hover {
      border-color: rgba(192, 132, 252, 0.38);
      color: #d8b4fe;
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

    .error-message {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      margin-bottom: 16px;
      padding: 12px 14px;
      border: 1px solid rgba(251, 113, 133, 0.24);
      border-radius: 8px;
      background: rgba(190, 18, 60, 0.09);
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

    .spinner {
      width: 18px;
      height: 18px;
      border: 2px solid rgba(255, 255, 255, 0.35);
      border-top-color: #ffffff;
      border-radius: 50%;
      animation:
        forgot-password-spin
        .75s linear infinite;
    }

    .email-result {
      display: flex;
      min-height: 68px;
      align-items: center;
      justify-content: center;
      gap: 12px;
      margin-bottom: 14px;
      padding: 14px 18px;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: rgba(8, 14, 28, 0.58);
    }

    .email-result svg {
      width: 24px;
      height: 24px;
      color: #c084fc;
    }

    .email-result strong {
      overflow: hidden;
      color: var(--text-strong);
      font-size: 15px;
      font-weight: 700;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .success-note {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-bottom: 22px;
      color: var(--text-muted);
      font-size: 13px;
    }

    .success-note svg {
      width: 17px;
      height: 17px;
    }

    .success-actions {
      display: grid;
      grid-template-columns:
        repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    .resend-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-top: 16px;
      border: 0;
      background: transparent;
      color: #b967ff;
      font: inherit;
      font-size: 13.5px;
      font-weight: 650;
      cursor: pointer;
    }

    .resend-button:hover {
      color: #d8b4fe;
    }

    .resend-button svg {
      width: 17px;
      height: 17px;
    }

    .forgot-card svg {
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    @keyframes forgot-password-spin {
      to {
        transform: rotate(360deg);
      }
    }

    @media (max-width: 620px) {
      .forgot-card {
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

      .success-actions {
        grid-template-columns: 1fr;
      }

      .card-footer p {
        flex-wrap: wrap;
      }
    }
  `],
})
export class ForgotPasswordCardComponent {
    private readonly formBuilder =
        inject(FormBuilder);

    @Input()
    status: ForgotPasswordStatus = 'idle';

    @Input()
    result: ForgotPasswordResult | null =
        null;

    @Input()
    errorMessage = '';

    @Input()
    initialEmail = '';

    @Output()
    readonly resetRequested =
        new EventEmitter<string>();

    @Output()
    readonly retry =
        new EventEmitter<void>();

    @Output()
    readonly useAnotherEmail =
        new EventEmitter<void>();

    @Output()
    readonly errorCleared =
        new EventEmitter<void>();

    protected readonly form =
        this.formBuilder.nonNullable.group({
            email: [
                '',
                [
                    Validators.required,
                    Validators.email,
                ],
            ],
        });

    protected get emailControl() {
        return this.form.controls.email;
    }

    protected handleSubmit(): void {
        this.form.markAllAsTouched();

        if (this.form.invalid) {
            return;
        }

        this.resetRequested.emit(
            this.emailControl.value.trim(),
        );
    }
}