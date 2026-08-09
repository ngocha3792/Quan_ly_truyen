import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
} from '@angular/core';

import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ActivatedRoute, RouterLink } from '@angular/router';

import { AuthStore } from '../../../../../core/auth/auth.store';

import { AUTH_PERMISSIONS } from '../../../../../core/auth/authorization.models';

import {
  BreadcrumbComponent,
  BreadcrumbItem,
} from '../../../../../shared/components/breadcrumb/breadcrumb.component';

import { ErrorAlertComponent } from '../../../../../shared/components/error-alert/error-alert.component';

import { LoadingStateComponent } from '../../../../../shared/components/loading-state/loading-state.component';

import { PageHeadingComponent } from '../../../../../shared/components/page-heading/page-heading.component';

import { AdminUsersStore } from '../../data-access/admin-users.store';

import { ManagedUserStatus } from '../../domain/admin-user.models';

@Component({
  selector: 'app-admin-user-detail-page',

  standalone: true,

  imports: [
    RouterLink,

    BreadcrumbComponent,

    ErrorAlertComponent,

    LoadingStateComponent,

    PageHeadingComponent,
  ],

  providers: [AdminUsersStore],

  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './admin-user-detail-page.component.html',

  styleUrl: './admin-user-detail-page.component.scss',
})
export class AdminUserDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);

  private readonly auth = inject(AuthStore);

  private readonly destroyRef = inject(DestroyRef);

  protected readonly store = inject(AdminUsersStore);

  protected readonly userId = this.route.snapshot.paramMap.get('userId') ?? '';

  protected readonly isSelf = computed(() => this.auth.user()?.id === this.store.detail()?.id);

  protected readonly canManageRoles = computed(() => {
    const user = this.auth.user();

    if (!user) {
      return false;
    }

    const targetPermission = AUTH_PERMISSIONS.ROLE_MANAGE.toLowerCase();

    return user.permissions.some((permission) => permission.toLowerCase() === targetPermission);
  });

  protected readonly breadcrumbs = computed<readonly BreadcrumbItem[]>(() => [
    {
      label: 'Trang chủ',

      route: '/',
    },

    {
      label: 'Quản trị',
    },

    {
      label: 'Người dùng',

      route: '/admin/users',
    },

    {
      label: this.store.detail()?.displayName ?? 'Chi tiết',
    },
  ]);

  ngOnInit(): void {
    if (this.userId) {
      this.store.loadDetail(this.userId);
    }
  }

  protected changeStatus(status: ManagedUserStatus): void {
    this.store.updateStatus(status).pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }

  protected grantAdmin(): void {
    this.store.assignAdminRole().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }

  protected removeAdmin(): void {
    this.store.removeAdminRole().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }

  protected hasRole(code: string): boolean {
    const user = this.store.detail();

    if (!user) {
      return false;
    }

    return user.roles.some((role) => role.code === code);
  }

  protected statusLabel(status: string): string {
    switch (status) {
      case 'ACTIVE':
        return 'Hoạt động';

      case 'SUSPENDED':
        return 'Tạm khóa';

      case 'BANNED':
        return 'Bị cấm';

      case 'DELETED':
        return 'Đã xóa';

      default:
        return status;
    }
  }

  protected formatDate(value: string | null): string {
    return value ? new Date(value).toLocaleString('vi-VN') : 'Chưa có';
  }
}
