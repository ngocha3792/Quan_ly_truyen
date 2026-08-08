import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { AdminAuthorApplicationStatus } from '../domain/admin-author-application.models';

@Component({
  selector: 'app-admin-author-application-status-badge',

  standalone: true,

  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <span
      class="status-badge"
      [class.status-badge--draft]="status() === 'DRAFT'"
      [class.status-badge--pending]="status() === 'PENDING'"
      [class.status-badge--approved]="status() === 'APPROVED'"
      [class.status-badge--rejected]="status() === 'REJECTED'"
    >
      {{ label() }}
    </span>
  `,

  styles: `
    :host {
      display: inline-flex;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;

      min-height: 26px;

      padding: 0 10px;

      border-radius: 999px;

      font-size: 12px;

      font-weight: 700;

      white-space: nowrap;
    }

    .status-badge--draft {
      color: #cbd5e1;

      background: rgba(148, 163, 184, 0.12);
    }

    .status-badge--pending {
      color: #fde68a;

      background: rgba(245, 158, 11, 0.14);
    }

    .status-badge--approved {
      color: #86efac;

      background: rgba(34, 197, 94, 0.14);
    }

    .status-badge--rejected {
      color: #fda4af;

      background: rgba(244, 63, 94, 0.14);
    }
  `,
})
export class AdminAuthorApplicationStatusBadgeComponent {
  readonly status = input.required<AdminAuthorApplicationStatus>();

  readonly label = computed(() => {
    switch (this.status()) {
      case 'DRAFT':
        return 'Bản nháp';

      case 'PENDING':
        return 'Chờ xét duyệt';

      case 'APPROVED':
        return 'Đã duyệt';

      case 'REJECTED':
        return 'Đã từ chối';

      default:
        return 'Không xác định';
    }
  });
}
