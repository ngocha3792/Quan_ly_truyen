import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

import { AdminReportStatus } from '../domain/admin-report.models';

@Component({
  selector: 'app-admin-report-status-badge',
  standalone: true,
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
}
