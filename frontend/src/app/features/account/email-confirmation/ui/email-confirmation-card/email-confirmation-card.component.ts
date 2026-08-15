import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

import { RouterLink } from '@angular/router';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';

import { AuthFlowCardComponent } from '../../../shared/ui/auth-flow-card/auth-flow-card.component';

import {
  EmailConfirmationResult,
  EmailConfirmationStatus,
} from '../../domain/email-confirmation.models';

@Component({
  selector: 'app-email-confirmation-card',

  standalone: true,

  imports: [RouterLink, IconComponent, AuthFlowCardComponent],

  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    @if (status === 'idle' || status === 'confirming') {
      <app-auth-flow-card
        icon="mail"
        eyebrow="ĐANG XÁC NHẬN"
        title="Đang xác nhận email mới"
        description="Vui lòng chờ trong giây lát trong khi TruyenHub kiểm tra liên kết xác nhận của bạn."
        [loading]="true"
      >
        <div class="progress-line">
          <span></span>
        </div>

        <p class="loading-note">Không đóng hoặc tải lại trang trong quá trình xác nhận.</p>
      </app-auth-flow-card>
    }

    @if (status === 'success' && result) {
      <app-auth-flow-card
        icon="check"
        eyebrow="XÁC NHẬN THÀNH CÔNG"
        title="Xác nhận email mới"
        description="Email mới của bạn đã được xác nhận thành công. Tài khoản đã được cập nhật và bạn có thể tiếp tục sử dụng TruyenHub."
        tone="success"
      >
        <div class="email-information">
          <span class="email-icon">
            <app-icon name="mail" [size]="18" />
          </span>

          <div>
            <small> Email mới </small>

            <strong>
              {{ result.email }}
            </strong>
          </div>
        </div>

        <div
          class="
            information-box
            information-box--success
          "
        >
          <app-icon name="info" [size]="18" />

          <span> Mọi thông báo quan trọng sẽ được gửi đến địa chỉ email này. </span>
        </div>

        <div class="action-grid">
          <a class="primary-button" routerLink="/tai-khoan">
            <app-icon name="user" [size]="17" />

            Về trang tài khoản
          </a>

          <a class="secondary-button" routerLink="/"> Quay lại trang chủ </a>
        </div>

        <div authFooter class="auth-footer">
          Cần hỗ trợ?

          <a routerLink="/cong-dong"> Liên hệ đội ngũ TruyenHub </a>.
        </div>
      </app-auth-flow-card>
    }

    @if (status === 'expired') {
      <app-auth-flow-card
        icon="alert-triangle"
        eyebrow="LIÊN KẾT HẾT HẠN"
        title="Không thể xác nhận email"
        [description]="errorMessage"
        tone="warning"
      >
        <div
          class="
            information-box
            information-box--warning
          "
        >
          <app-icon name="clock" [size]="18" />

          <span> Liên kết xác nhận chỉ có hiệu lực trong một khoảng thời gian nhất định. </span>
        </div>

        <div class="action-grid">
          <a class="primary-button" routerLink="/tai-khoan/bao-mat"> Yêu cầu gửi lại email </a>

          <a class="secondary-button" routerLink="/"> Quay lại trang chủ </a>
        </div>
      </app-auth-flow-card>
    }

    @if (status === 'error') {
      <app-auth-flow-card
        icon="alert-triangle"
        eyebrow="XÁC NHẬN THẤT BẠI"
        title="Liên kết không hợp lệ"
        [description]="errorMessage"
        tone="danger"
      >
        <div class="action-grid">
          <button class="primary-button" type="button" (click)="retry.emit()">
            Thử xác nhận lại
          </button>

          <a class="secondary-button" routerLink="/"> Quay lại trang chủ </a>
        </div>

        <div authFooter class="auth-footer">
          Cần hỗ trợ?

          <a routerLink="/cong-dong"> Liên hệ đội ngũ TruyenHub </a>.
        </div>
      </app-auth-flow-card>
    }
  `,

  styles: `
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

      animation: confirmation-progress 1.15s ease-in-out infinite alternate;
    }

    .loading-note {
      margin: 13px 0 0;

      color: #778196;

      font-size: 11.5px;
    }

    .email-information,
    .information-box {
      padding: 13px 14px;

      border: 1px solid rgba(139, 151, 181, 0.16);

      border-radius: 9px;

      background: rgba(5, 10, 21, 0.38);
    }

    .email-information {
      display: flex;

      align-items: center;

      gap: 11px;

      text-align: left;
    }

    .email-icon {
      width: 38px;
      height: 38px;

      display: grid;

      place-items: center;

      flex: 0 0 38px;

      border-radius: 9px;

      color: #c084fc;

      background: rgba(126, 34, 206, 0.15);
    }

    .email-information div {
      min-width: 0;

      display: grid;

      gap: 2px;
    }

    .email-information small {
      color: #7f899d;

      font-size: 11px;
    }

    .email-information strong {
      color: #e9d5ff;

      font-size: 13.5px;

      overflow-wrap: anywhere;
    }

    .information-box {
      margin-top: 13px;

      display: flex;

      align-items: center;

      gap: 9px;

      color: #cbd5e1;

      font-size: 12.5px;

      text-align: left;
    }

    .information-box--success {
      color: #86efac;

      border-color: rgba(74, 222, 128, 0.2);

      background: rgba(22, 163, 74, 0.08);
    }

    .information-box--warning {
      color: #fde68a;

      border-color: rgba(251, 191, 36, 0.22);

      background: rgba(217, 119, 6, 0.08);
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

    .auth-footer {
      margin-top: 24px;

      padding-top: 17px;

      border-top: 1px solid rgba(139, 151, 181, 0.12);

      color: #778196;

      font-size: 11.5px;

      line-height: 1.65;
    }

    .auth-footer a {
      color: #a96df2;

      text-decoration: none;
    }

    @keyframes confirmation-progress {
      from {
        transform: translateX(0);
      }

      to {
        transform: translateX(135%);
      }
    }

    @media (max-width: 520px) {
      .action-grid {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class EmailConfirmationCardComponent {
  @Input({
    required: true,
  })
  status: EmailConfirmationStatus = 'idle';

  @Input()
  result: EmailConfirmationResult | null = null;

  @Input()
  errorMessage = '';

  @Output()
  readonly retry = new EventEmitter<void>();
}
