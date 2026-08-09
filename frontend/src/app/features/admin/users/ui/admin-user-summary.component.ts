import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

import { AdminUserDetail } from '../domain/admin-user.models';

@Component({
  selector: 'app-admin-user-summary',
  standalone: true,
  templateUrl: './admin-user-summary.component.html',
  styleUrl: './admin-user-summary.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminUserSummaryComponent {
  @Input({ required: true }) user!: AdminUserDetail;
  protected formatDate(value: string | null): string {
    return value ? new Date(value).toLocaleString('vi-VN') : 'Chưa có';
  }
}
