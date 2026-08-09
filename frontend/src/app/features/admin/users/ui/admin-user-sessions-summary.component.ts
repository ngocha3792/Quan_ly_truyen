import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { AdminUserDetail } from '../domain/admin-user.models';

@Component({
  selector: 'app-admin-user-sessions-summary',
  standalone: true,
  templateUrl: './admin-user-sessions-summary.component.html',
  styleUrl: './admin-user-sessions-summary.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminUserSessionsSummaryComponent {
  @Input({ required: true }) user!: AdminUserDetail;
  protected formatDate(value: string | null): string {
    return value ? new Date(value).toLocaleString('vi-VN') : 'Chưa có';
  }
}
