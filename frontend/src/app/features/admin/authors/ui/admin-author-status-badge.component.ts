import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

import { AuthorLifecycleStatus } from '../domain/admin-author.models';

@Component({
  selector: 'app-admin-author-status-badge',
  standalone: true,
  templateUrl: './admin-author-status-badge.component.html',
  styleUrl: './admin-author-status-badge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminAuthorStatusBadgeComponent {
  @Input({ required: true }) status!: AuthorLifecycleStatus;

  protected get label(): string {
    return {
      ACTIVE: 'Hoạt động',
      SUSPENDED: 'Tạm khóa',
      REVOKED: 'Đã thu hồi',
    }[this.status];
  }
}
