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
import { AdminUserActionsStore } from '../../data-access/admin-user-actions.store';
import { AdminUserDetailStore } from '../../data-access/admin-user-detail.store';
import { ManagedUserStatus } from '../../domain/admin-user.models';
import { AdminUserHeaderComponent } from '../../ui/admin-user-header.component';
import { AdminUserRolesComponent } from '../../ui/admin-user-roles.component';
import { AdminUserSessionsSummaryComponent } from '../../ui/admin-user-sessions-summary.component';
import { AdminUserSummaryComponent } from '../../ui/admin-user-summary.component';

@Component({
  selector: 'app-admin-user-detail-page',
  standalone: true,
  imports: [
    RouterLink,
    BreadcrumbComponent,
    ErrorAlertComponent,
    LoadingStateComponent,
    PageHeadingComponent,
    AdminUserHeaderComponent,
    AdminUserSummaryComponent,
    AdminUserSessionsSummaryComponent,
    AdminUserRolesComponent,
  ],
  providers: [AdminUserDetailStore, AdminUserActionsStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-user-detail-page.component.html',
  styleUrl: './admin-user-detail-page.component.scss',
})
export class AdminUserDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthStore);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly detailStore = inject(AdminUserDetailStore);
  protected readonly actionsStore = inject(AdminUserActionsStore);
  protected readonly userId = this.route.snapshot.paramMap.get('userId') ?? '';
  protected readonly isSelf = computed(
    () => this.auth.user()?.id === this.detailStore.detail()?.id,
  );
  protected readonly canManageRoles = computed(() => {
    const user = this.auth.user();
    const permission = AUTH_PERMISSIONS.ROLE_MANAGE.toLowerCase();
    return Boolean(user?.permissions.some((item) => item.toLowerCase() === permission));
  });
  protected readonly breadcrumbs = computed<readonly BreadcrumbItem[]>(() => [
    { label: 'Trang chủ', route: '/' },
    { label: 'Quản trị' },
    { label: 'Người dùng', route: '/admin/users' },
    { label: this.detailStore.detail()?.displayName ?? 'Chi tiết' },
  ]);
  ngOnInit(): void {
    if (this.userId) {
      this.actionsStore.clearFeedback();
      this.detailStore.load(this.userId);
    }
  }
  protected changeStatus(status: ManagedUserStatus): void {
    this.actionsStore.updateStatus(status).pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }
  protected grantAdmin(): void {
    this.actionsStore.assignAdminRole().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }
  protected removeAdmin(): void {
    this.actionsStore.removeAdminRole().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }
}
