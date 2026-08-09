import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { AdminAuthorApplicationStatus } from '../domain/admin-author-application.models';

@Component({
  selector: 'app-admin-author-application-status-badge',

  standalone: true,

  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './admin-author-application-status-badge.component.html',

  styleUrl: './admin-author-application-status-badge.component.scss',
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
