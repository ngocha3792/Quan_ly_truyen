import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

import { AdminUserDetail, ManagedUserStatus } from '../domain/admin-user.models';
import { AdminUserStatusBadgeComponent } from './admin-user-status-badge.component';

@Component({
  selector: 'app-admin-user-header',
  standalone: true,
  imports: [AdminUserStatusBadgeComponent],
  templateUrl: './admin-user-header.component.html',
  styleUrl: './admin-user-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminUserHeaderComponent {
  @Input({ required: true }) user!: AdminUserDetail;
  @Input() isSelf = false;
  @Input() actionLoading = false;
  @Output() readonly statusChange = new EventEmitter<ManagedUserStatus>();
}
