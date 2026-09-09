import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

import { AdminReportStatus } from '../domain/admin-report.models';
import {
  StatusBadgeComponent,
  StatusBadgeTone,
} from '../../../../shared/components/status-badge/status-badge.component';

@Component({
  selector: 'app-admin-report-status-badge',
  standalone: true,
  imports: [StatusBadgeComponent],
  templateUrl: './admin-report-status-badge.component.html',
  styleUrl: './admin-report-status-badge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminReportStatusBadgeComponent {
  @Input({ required: true }) status!: AdminReportStatus;

  protected get label(): string {
    return {
      OPEN: 'Mới',
      IN_REVIEW: 'Đang xử lý',
      RESOLVED: 'Đã xử lý',
      REJECTED: 'Đã từ chối',
    }[this.status];
  }

  protected get tone(): StatusBadgeTone {
    return {
      OPEN: 'info',
      IN_REVIEW: 'warning',
      RESOLVED: 'success',
      REJECTED: 'danger',
    }[this.status] as StatusBadgeTone;
  }
}
