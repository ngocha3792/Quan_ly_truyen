import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

import { ManagedUserStatus } from '../domain/admin-user.models';

@Component({
  selector: 'app-admin-user-status-badge',
  standalone: true,
  templateUrl: './admin-user-status-badge.component.html',
  styleUrl: './admin-user-status-badge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminUserStatusBadgeComponent {
  @Input({ required: true }) status!: ManagedUserStatus;

  protected get label(): string {
    return {
      ACTIVE: 'Hoạt động',
      SUSPENDED: 'Tạm khóa',
      BANNED: 'Bị cấm',
      DELETED: 'Đã xóa',
    }[this.status];
  }
}
