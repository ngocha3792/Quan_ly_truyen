import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { AdminUserSummary } from '../domain/admin-user.models';
import { AdminUserStatusBadgeComponent } from './admin-user-status-badge.component';

@Component({
  selector: 'app-admin-users-table',
  standalone: true,
  imports: [RouterLink, PaginationComponent, AdminUserStatusBadgeComponent],
  templateUrl: './admin-users-table.component.html',
  styleUrl: './admin-users-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminUsersTableComponent {
  @Input({ required: true }) users!: readonly AdminUserSummary[];
  @Input() total = 0;
  @Input() page = 1;
  @Input() totalPages = 1;
  @Output() readonly pageChange = new EventEmitter<number>();

  protected formatDate(value: string | null): string {
    return value ? new Date(value).toLocaleString('vi-VN') : 'Chưa có';
  }
}
