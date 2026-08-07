
import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    Output,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import {
    EmailConfirmationResult,
    EmailConfirmationStatus,
} from '../../domain/email-confirmation.models';

@Component({
    selector: 'app-email-confirmation-card',
    standalone: true,

    imports: [
        RouterLink,
    ],

    changeDetection:
        ChangeDetectionStrategy.OnPush,

    template: `
    <section
      class="confirmation-card"
      [attr.data-status]="status"
    >
      <div
        class="card-decoration"
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
        status === 'confirming'
      ) {
        <div class="status-icon status-icon--loading">
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

          <span class="loading-ring"></span>
        </div>

        <span class="status-label">
          ĐANG XÁC NHẬN
        </span>

        <h1>Đang xác nhận email mới</h1>

        <p class="description">
          Vui lòng chờ trong giây lát trong khi
          TruyenHub kiểm tra liên kết xác nhận
          của bạn.
        </p>

        <div class="loading-line">
          <span></span>
        </div>

        <p class="loading-note">
          Không đóng hoặc tải lại trang trong
          quá trình xác nhận.
        </p>
      }

      @if (
        status === 'success' &&
        result
      ) {
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

            <path d="m15 17 1.4 1.4L19 15.8"></path>
          </svg>
        </div>

        <span class="status-label">
          XÁC NHẬN THÀNH CÔNG
        </span>

        <h1>Xác nhận email mới</h1>

        <p class="description">
          Email mới của bạn đã được xác nhận
          thành công.
          <br>
          Tài khoản đã được cập nhật và bạn có
          thể tiếp tục sử dụng TruyenHub.
        </p>

        <div class="email-information">
          <span class="email-icon">
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
          </span>

          <div>
            <small>Email mới</small>

            <strong>
              {{ result.email }}
            </strong>
          </div>
        </div>

        <p class="information-note">
          <svg viewBox="0 0 24 24">
            <circle
              cx="12"
              cy="12"
              r="9"
            ></circle>

            <path d="M12 11v5"></path>
            <path d="M12 8h.01"></path>
          </svg>

          Mọi thông báo quan trọng sẽ được gửi
          đến địa chỉ email này.
        </p>

        <div class="card-actions">
          <a
            class="primary-button"
            routerLink="/tai-khoan"
          >
            <svg viewBox="0 0 24 24">
              <circle
                cx="12"
                cy="8"
                r="3"
              ></circle>

              <path
                d="M5 20c.5-4 2.8-6 7-6s6.5 2 7 6"
              ></path>
            </svg>

            Về trang tài khoản
          </a>

          <a
            class="secondary-button"
            routerLink="/"
          >
            <svg viewBox="0 0 24 24">
              <path d="m3 11 9-8 9 8"></path>

              <path
                d="M5 10v10h5v-6h4v6h5V10"
              ></path>
            </svg>

            Quay lại trang chủ
          </a>
        </div>

        <div class="support-row">
          <svg viewBox="0 0 24 24">
            <path
              d="M4 13v-2a8 8 0 0 1 16 0v2"
            ></path>

            <path
              d="M4 13a2 2 0 0 1 2-2h1v6H6a2 2 0 0 1-2-2v-2Z"
            ></path>

            <path
              d="M20 13a2 2 0 0 0-2-2h-1v6h1"
            ></path>

            <path d="M18 17c0 2-2 3-5 3"></path>
          </svg>

          <span>
            Cần hỗ trợ?
          </span>

          <a routerLink="/lien-he-ho-tro">
            Liên hệ đội ngũ TruyenHub
          </a>
        </div>
      }

      @if (status === 'expired') {
        <div class="status-icon status-icon--warning">
          <svg viewBox="0 0 24 24">
            <circle
              cx="12"
              cy="12"
              r="9"
            ></circle>

            <path d="M12 7v5"></path>
            <path d="M12 16h.01"></path>
          </svg>
        </div>

        <span class="status-label status-label--warning">
          LIÊN KẾT HẾT HẠN
        </span>

        <h1>Không thể xác nhận email</h1>

        <p class="description">
          {{ errorMessage }}
        </p>

        <div class="error-information">
          <svg viewBox="0 0 24 24">
            <circle
              cx="12"
              cy="12"
              r="9"
            ></circle>

            <path d="M12 7v5"></path>
            <path d="M12 16h.01"></path>
          </svg>

          <span>
            Liên kết xác nhận chỉ có hiệu lực
            trong một khoảng thời gian nhất định.
          </span>
        </div>

        <div class="card-actions">
          <a
            class="primary-button"
            routerLink="/tai-khoan/bao-mat"
          >
            Yêu cầu gửi lại email
          </a>

          <a
            class="secondary-button"
            routerLink="/"
          >
            Quay lại trang chủ
          </a>
        </div>
      }

      @if (status === 'error') {
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
          XÁC NHẬN THẤT BẠI
        </span>

        <h1>Liên kết không hợp lệ</h1>

        <p class="description">
          {{ errorMessage }}
        </p>

        <div class="card-actions">
          <button
            class="primary-button"
            type="button"
            (click)="retry.emit()"
          >
            <svg viewBox="0 0 24 24">
              <path
                d="M3 12a9 9 0 1 0 3-6.7"
              ></path>

              <path d="M3 4v6h6"></path>
            </svg>

            Thử xác nhận lại
          </button>

          <a
            class="secondary-button"
            routerLink="/"
          >
            Quay lại trang chủ
          </a>
        </div>

        <div class="support-row">
          <svg viewBox="0 0 24 24">
            <path
              d="M4 13v-2a8 8 0 0 1 16 0v2"
            ></path>

            <path
              d="M4 13a2 2 0 0 1 2-2h1v6H6a2 2 0 0 1-2-2v-2Z"
            ></path>
          </svg>

          <span>Cần hỗ trợ?</span>

          <a routerLink="/lien-he-ho-tro">
            Liên hệ đội ngũ TruyenHub
          </a>
        </div>
      }
    </section>
  `,

    styles: [`
    :host {
      display: block;
      width: 100%;
    }

    .confirmation-card {
      position: relative;
      width: min(680px, 100%);
      min-height: auto;
      margin: 0 auto;
      overflow: hidden;
      padding: 40px 56px 36px;
      border: 1px solid var(--border);
      border-radius: 16px;
      background:
        radial-gradient(
          circle at 50% 14%,
          rgba(126, 34, 206, 0.12),
          transparent 28%
        ),
        linear-gradient(
          145deg,
          rgba(16, 22, 39, 0.96),
          rgba(9, 15, 29, 0.98)
        );
      box-shadow:
        0 28px 75px rgba(0, 0, 0, 0.22),
        inset 0 1px 0 rgba(255, 255, 255, 0.018);
      text-align: center;
      isolation: isolate;
    }

    .confirmation-card::before {
      position: absolute;
      top: -180px;
      left: 50%;
      z-index: -1;
      width: 430px;
      height: 300px;
      border-radius: 50%;
      content: "";
      background: rgba(126, 34, 206, 0.13);
      filter: blur(75px);
      transform: translateX(-50%);
    }

    .card-decoration {
      position: absolute;
      top: 42px;
      left: 50%;
      width: 280px;
      height: 100px;
      pointer-events: none;
      transform: translateX(-50%);
    }

    .sparkle {
      position: absolute;
      color: rgba(192, 132, 252, 0.75);
      text-shadow: 0 0 12px rgba(168, 85, 247, 0.75);
    }

    .sparkle--one {
      top: 22px;
      left: 17px;
      font-size: 13px;
    }

    .sparkle--two {
      top: 14px;
      right: 14px;
      font-size: 11px;
    }

    .sparkle--three {
      right: 43px;
      bottom: 13px;
      font-size: 13px;
    }

    .status-icon {
      position: relative;
      display: grid;
      width: 96px;
      height: 96px;
      margin: 0 auto 20px;
      place-items: center;
      border: 1px solid rgba(192, 132, 252, 0.32);
      border-radius: 50%;
      background:
        radial-gradient(
          circle,
          rgba(147, 51, 234, 0.4),
          rgba(76, 29, 149, 0.1) 68%
        );
      color: #c084fc;
      box-shadow:
        0 0 34px rgba(168, 85, 247, 0.18),
        inset 0 0 20px rgba(168, 85, 247, 0.08);
    }

    .status-icon svg {
      width: 58px;
      height: 58px;
    }

    .status-icon--warning {
      border-color: rgba(250, 204, 21, 0.34);
      background:
        radial-gradient(
          circle,
          rgba(202, 138, 4, 0.3),
          rgba(113, 63, 18, 0.08) 68%
        );
      color: #facc15;
    }

    .status-icon--error {
      border-color: rgba(251, 113, 133, 0.34);
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
      border: 1px solid rgba(192, 132, 252, 0.35);
      border-radius: 999px;
      background: rgba(126, 34, 206, 0.2);
      color: #d8b4fe;
      font-size: 11.5px;
      font-weight: 800;
      letter-spacing: 0.065em;
    }

    .status-label--warning {
      border-color: rgba(250, 204, 21, 0.28);
      background: rgba(202, 138, 4, 0.12);
      color: #fde047;
    }

    .status-label--error {
      border-color: rgba(251, 113, 133, 0.27);
      background: rgba(190, 18, 60, 0.12);
      color: #fda4af;
    }

    h1 {
      margin: 0;
      color: #f8f6fb;
      font-size: clamp(1.75rem, 3vw, 2.2rem);
      line-height: 1.25;
      letter-spacing: -0.8px;
    }

    .description {
      margin: 12px auto 22px;
      color: var(--text-secondary);
      font-size: 14.5px;
      line-height: 1.65;
    }

    .email-information {
      display: flex;
      min-height: 76px;
      align-items: center;
      gap: 16px;
      margin-top: 18px;
      padding: 14px 20px;
      border: 1px solid var(--border);
      border-radius: 12px;
      background:
        linear-gradient(
          90deg,
          rgba(126, 34, 206, 0.08),
          rgba(10, 16, 31, 0.64)
        );
      text-align: left;
    }

    .email-icon {
      display: grid;
      width: 48px;
      height: 48px;
      flex: 0 0 auto;
      place-items: center;
      border-radius: 12px;
      background: rgba(126, 34, 206, 0.22);
      color: #c084fc;
    }

    .email-icon svg {
      width: 25px;
      height: 25px;
    }

    .email-information div {
      display: grid;
      min-width: 0;
      gap: 4px;
    }

    .email-information small {
      color: var(--text-muted);
      font-size: 12px;
    }

    .email-information strong {
      overflow: hidden;
      color: var(--text-strong);
      font-size: 15px;
      font-weight: 700;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .information-note {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin: 16px 0 24px;
      color: var(--text-muted);
      font-size: 13px;
    }

    .information-note svg {
      width: 17px;
      height: 17px;
      flex: 0 0 auto;
    }

    .card-actions {
      display: grid;
      grid-template-columns:
        repeat(2, minmax(0, 1fr));
      gap: 14px;
    }

    .primary-button,
    .secondary-button {
      display: inline-flex;
      min-height: 48px;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 11px 20px;
      border-radius: 9px;
      color: #ffffff;
      font: inherit;
      font-size: 14px;
      font-weight: 700;
      text-decoration: none;
      cursor: pointer;
    }

    .primary-button {
      border: 1px solid rgba(216, 180, 254, 0.25);
      background:
        linear-gradient(
          135deg,
          #a855f7,
          #7c3aed
        );
      box-shadow:
        0 9px 27px rgba(126, 34, 206, 0.27),
        inset 0 1px 0 rgba(255, 255, 255, 0.13);
    }

    button.primary-button {
      width: 100%;
    }

    .primary-button:hover {
      background:
        linear-gradient(
          135deg,
          #b967ff,
          #8b5cf6
        );
    }

    .secondary-button {
      border: 1px solid rgba(139, 151, 190, 0.23);
      background: rgba(8, 14, 28, 0.58);
    }

    .secondary-button:hover {
      border-color: rgba(192, 132, 252, 0.36);
      color: #d8b4fe;
    }

    .primary-button svg,
    .secondary-button svg {
      width: 20px;
      height: 20px;
    }

    .support-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-top: 22px;
      padding-top: 18px;
      border-top: 1px solid var(--border);
      color: var(--text-secondary);
      font-size: 13.5px;
    }

    .support-row svg {
      width: 18px;
      height: 18px;
    }

    .support-row a {
      color: #b967ff;
      font-size: 13.5px;
      font-weight: 650;
      text-decoration: none;
    }

    .support-row a:hover {
      color: #d8b4fe;
    }

    .error-information {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      margin: 6px 0 24px;
      padding: 14px 18px;
      border: 1px solid rgba(250, 204, 21, 0.18);
      border-radius: 10px;
      background: rgba(202, 138, 4, 0.07);
      color: #d7cfaa;
      font-size: 13.5px;
      line-height: 1.55;
      text-align: left;
    }

    .error-information svg {
      width: 20px;
      height: 20px;
      flex: 0 0 auto;
      color: #facc15;
    }

    .loading-ring {
      position: absolute;
      inset: -1px;
      border: 2px solid transparent;
      border-top-color: #c084fc;
      border-right-color: rgba(192, 132, 252, 0.25);
      border-radius: 50%;
      animation:
        email-confirmation-spin
        1s linear infinite;
    }

    .loading-line {
      height: 6px;
      margin: 32px auto 18px;
      overflow: hidden;
      border-radius: 999px;
      background: rgba(105, 116, 145, 0.22);
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
        email-confirmation-progress
        1.35s ease-in-out infinite;
    }

    .loading-note {
      margin: 0;
      color: var(--text-muted);
      font-size: 13px;
    }

    .confirmation-card svg {
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    @keyframes email-confirmation-spin {
      to {
        transform: rotate(360deg);
      }
    }

    @keyframes email-confirmation-progress {
      from {
        transform: translateX(-120%);
      }

      to {
        transform: translateX(360%);
      }
    }

    @media (max-width: 620px) {
      .confirmation-card {
        min-height: 480px;
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

      .card-actions {
        grid-template-columns: 1fr;
      }

      .support-row {
        flex-wrap: wrap;
      }
    }
  `],
})
export class EmailConfirmationCardComponent {
    @Input({ required: true })
    status: EmailConfirmationStatus =
        'idle';

    @Input()
    result: EmailConfirmationResult | null =
        null;

    @Input()
    errorMessage = '';

    @Output()
    readonly retry =
        new EventEmitter<void>();
}