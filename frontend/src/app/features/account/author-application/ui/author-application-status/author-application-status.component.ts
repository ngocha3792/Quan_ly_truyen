import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

import { RouterLink } from '@angular/router';

import { AuthorApplicationRecord } from '../../domain/author-application.models';

@Component({
  selector: 'app-author-application-status',

  standalone: true,

  imports: [RouterLink],

  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <section class="status-card">
      @if (application.status === 'PENDING') {
        <span class="status-badge pending"> Đang chờ xét duyệt </span>

        <h2>Hồ sơ của bạn đã được gửi</h2>

        <p>
          Đội ngũ quản trị đang xem xét hồ sơ. Bạn không thể chỉnh sửa hồ sơ trong thời gian này.
        </p>

        @if (application.submittedAt) {
          <small>
            Gửi lúc:
            {{ formatDate(application.submittedAt) }}
          </small>
        }

        <button
          type="button"
          class="refresh-button"
          [disabled]="checking"
          (click)="refreshStatus.emit()"
        >
          {{ checking ? 'Đang kiểm tra...' : 'Kiểm tra trạng thái' }}
        </button>
      }

      @if (application.status === 'APPROVED') {
        <span class="status-badge approved"> Đã được duyệt </span>

        <h2>Tài khoản tác giả đã được kích hoạt</h2>

        <p>
          Bút danh
          <strong>
            {{ application.penName }}
          </strong>
          đã được xác minh.
        </p>

        <a class="studio-button" routerLink="/author-studio"> Vào Author Studio </a>
      }
    </section>
  `,

  styles: `
    :host {
      display: block;
    }

    .status-card {
      padding: 32px;

      border: 1px solid var(--border);

      border-radius: 14px;

      background: rgba(15, 23, 42, 0.72);
    }

    .status-badge {
      display: inline-flex;

      margin-bottom: 14px;

      padding: 5px 10px;

      border-radius: 999px;

      font-size: 12px;

      font-weight: 700;
    }

    .pending {
      color: #fde68a;

      background: rgba(245, 158, 11, 0.15);
    }

    .approved {
      color: #86efac;

      background: rgba(34, 197, 94, 0.15);
    }

    h2 {
      margin: 0 0 10px;
    }

    p {
      color: var(--text-secondary);

      line-height: 1.6;
    }

    small {
      display: block;

      margin-top: 16px;

      color: var(--text-secondary);
    }

    .refresh-button {
      margin-top: 18px;

      min-height: 38px;

      padding: 0 16px;

      border: 1px solid rgba(168, 85, 247, 0.32);

      border-radius: 8px;

      color: #e9d5ff;

      font-weight: 700;

      cursor: pointer;

      background: rgba(124, 58, 237, 0.12);
    }

    .refresh-button:disabled {
      opacity: 0.6;

      cursor: not-allowed;
    }

    .studio-button {
      display: inline-flex;

      margin-top: 18px;

      padding: 11px 18px;

      border-radius: 8px;

      color: #fff;

      background: linear-gradient(135deg, #743cdd, #a451eb);

      font-weight: 700;

      text-decoration: none;
    }
  `,
})
export class AuthorApplicationStatusComponent {
  @Input({
    required: true,
  })
  application!: AuthorApplicationRecord;

  @Input()
  checking = false;

  @Output()
  refreshStatus = new EventEmitter<void>();

  protected formatDate(value: string): string {
    return new Date(value).toLocaleString('vi-VN');
  }
}
