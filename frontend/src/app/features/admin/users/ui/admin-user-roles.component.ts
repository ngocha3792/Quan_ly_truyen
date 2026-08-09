import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { AdminUserDetail } from '../domain/admin-user.models';

@Component({
  selector: 'app-admin-user-roles',
  standalone: true,
  templateUrl: './admin-user-roles.component.html',
  styleUrl: './admin-user-roles.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminUserRolesComponent {
  @Input({ required: true }) user!: AdminUserDetail;
  @Input() canManage = false;
  @Input() isSelf = false;
  @Input() actionLoading = false;
  @Output() readonly grantAdmin = new EventEmitter<void>();
  @Output() readonly removeAdmin = new EventEmitter<void>();
  protected hasAdmin(): boolean {
    return this.user.roles.some((role) => role.code === 'ADMIN');
  }
  protected formatDate(value: string): string {
    return new Date(value).toLocaleString('vi-VN');
  }
}
