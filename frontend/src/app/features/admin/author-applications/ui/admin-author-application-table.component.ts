import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { RouterLink } from '@angular/router';

import { AdminAuthorApplicationRecord } from '../domain/admin-author-application.models';

import { AdminAuthorApplicationStatusBadgeComponent } from './admin-author-application-status-badge.component';

@Component({
  selector: 'app-admin-author-application-table',

  standalone: true,

  imports: [RouterLink, AdminAuthorApplicationStatusBadgeComponent],

  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Người đăng ký</th>

            <th>Bút danh</th>

            <th>Ngày gửi</th>

            <th>Trạng thái</th>

            <th class="action-column">Thao tác</th>
          </tr>
        </thead>

        <tbody>
          @for (application of applications(); track application.applicationId) {
            <tr>
              <td>
                <div class="applicant">
                  <strong>
                    {{ application.fullName || 'Chưa cập nhật' }}
                  </strong>

                  <small>
                    {{ application.email || application.userId }}
                  </small>
                </div>
              </td>

              <td>
                <span class="pen-name">
                  {{ application.penName || '—' }}
                </span>
              </td>

              <td>
                {{ formatDate(application.submittedAt) }}
              </td>

              <td>
                <app-admin-author-application-status-badge [status]="application.status" />
              </td>

              <td class="action-column">
                <a
                  class="review-link"
                  [routerLink]="['/admin/author-applications', application.applicationId]"
                >
                  Xem hồ sơ
                </a>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,

  styles: `
    :host {
      display: block;
    }

    .table-scroll {
      overflow-x: auto;
    }

    table {
      width: 100%;

      min-width: 760px;

      border-collapse: collapse;
    }

    th,
    td {
      padding: 15px 18px;

      border-bottom: 1px solid var(--border);

      text-align: left;
    }

    th {
      color: #7f899d;

      font-size: 12px;

      font-weight: 700;

      text-transform: uppercase;

      letter-spacing: 0.04em;
    }

    td {
      color: #cbd5e1;

      font-size: 14px;
    }

    tbody tr {
      transition: background 160ms ease;
    }

    tbody tr:hover {
      background: rgba(124, 58, 237, 0.045);
    }

    .applicant {
      display: grid;

      gap: 4px;
    }

    .applicant strong {
      color: #f1f5f9;

      font-size: 14px;
    }

    .applicant small {
      color: #7f899d;

      font-size: 12px;
    }

    .pen-name {
      color: #e2e8f0;

      font-weight: 600;
    }

    .action-column {
      width: 130px;

      text-align: right;
    }

    .review-link {
      display: inline-flex;

      min-height: 34px;

      align-items: center;

      padding: 0 13px;

      border: 1px solid rgba(168, 85, 247, 0.26);

      border-radius: 7px;

      color: #c4a5f6;

      font-size: 12px;

      font-weight: 700;

      text-decoration: none;

      background: rgba(124, 58, 237, 0.08);
    }

    .review-link:hover {
      color: #fff;

      border-color: rgba(168, 85, 247, 0.5);

      background: rgba(124, 58, 237, 0.18);
    }
  `,
})
export class AdminAuthorApplicationTableComponent {
  readonly applications = input.required<readonly AdminAuthorApplicationRecord[]>();

  protected formatDate(value: string | null): string {
    if (!value) {
      return 'Chưa gửi';
    }

    return new Date(value).toLocaleString('vi-VN');
  }
}
