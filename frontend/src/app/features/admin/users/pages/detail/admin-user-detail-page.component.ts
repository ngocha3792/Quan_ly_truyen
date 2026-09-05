import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthStore } from '../../../../../core/auth/auth.store';
import { AUTH_PERMISSIONS } from '../../../../../core/auth/authorization.models';
import { getApiErrorMessage } from '../../../../../core/http/api-error.util';
import {
  BreadcrumbComponent,
  BreadcrumbItem,
} from '../../../../../shared/components/breadcrumb/breadcrumb.component';
import { ButtonComponent } from '../../../../../shared/components/button/button.component';
import { ErrorAlertComponent } from '../../../../../shared/components/error-alert/error-alert.component';
import { LoadingStateComponent } from '../../../../../shared/components/loading-state/loading-state.component';
import { PageHeadingComponent } from '../../../../../shared/components/page-heading/page-heading.component';
import { AdminUserActionsStore } from '../../data-access/admin-user-actions.store';
import { AdminUserDetailStore } from '../../data-access/admin-user-detail.store';
import { AdminUsersApiService } from '../../data-access/admin-users-api.service';
import {
  AdminUserSecurityEvent,
  AdminUserSession,
  ManagedUserStatus,
} from '../../domain/admin-user.models';
import { AdminUserHeaderComponent } from '../../ui/admin-user-header.component';
import { AdminUserRolesComponent } from '../../ui/admin-user-roles.component';
import { AdminUserSessionsSummaryComponent } from '../../ui/admin-user-sessions-summary.component';
import { AdminUserSummaryComponent } from '../../ui/admin-user-summary.component';

@Component({
  selector: 'app-admin-user-detail-page',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    BreadcrumbComponent,
    ButtonComponent,
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
  private readonly api = inject(AdminUsersApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly detailStore = inject(AdminUserDetailStore);
  protected readonly actionsStore = inject(AdminUserActionsStore);
  protected readonly userId = this.route.snapshot.paramMap.get('userId') ?? '';
  protected readonly sessions = signal<readonly AdminUserSession[]>([]);
  protected readonly securityEvents = signal<readonly AdminUserSecurityEvent[]>([]);
  protected readonly securityLoading = signal(false);
  protected readonly securityError = signal('');
  protected readonly securityMessage = signal('');
  protected readonly pendingStatus = signal<ManagedUserStatus | null>(null);
  protected statusReason = '';

  protected readonly isSelf = computed(
    () => this.auth.user()?.id === this.detailStore.detail()?.id,
  );
  protected readonly canManageRoles = computed(() =>
    this.hasPermission(AUTH_PERMISSIONS.ROLE_MANAGE),
  );
  protected readonly canReadSecurity = computed(() =>
    this.hasPermission(AUTH_PERMISSIONS.USER_SECURITY_READ),
  );
  protected readonly canManageSecurity = computed(() =>
    this.hasPermission(AUTH_PERMISSIONS.USER_SECURITY_MANAGE),
  );
  protected readonly breadcrumbs = computed<readonly BreadcrumbItem[]>(() => [
    { label: 'Trang chủ', route: '/' },
    { label: 'Quản trị' },
    { label: 'Người dùng', route: '/admin/users' },
    { label: this.detailStore.detail()?.displayName ?? 'Chi tiết' },
  ]);

  ngOnInit(): void {
    if (!this.userId) return;
    this.actionsStore.clearFeedback();
    this.detailStore.load(this.userId);
    if (this.canReadSecurity()) this.loadSecurity();
  }

  protected changeStatus(status: ManagedUserStatus): void {
    if (status === 'ACTIVE') {
      if (window.confirm('Kích hoạt lại tài khoản này?')) this.submitStatus(status);
      return;
    }
    this.statusReason = '';
    this.pendingStatus.set(status);
  }

  protected confirmStatus(): void {
    const status = this.pendingStatus();
    const reason = this.statusReason.trim();
    if (!status || reason.length < 10) return;
    this.submitStatus(status, reason);
  }

  protected grantAdmin(): void {
    if (!window.confirm('Cấp quyền ADMIN cho người dùng này?')) return;
    this.actionsStore.assignAdminRole().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }

  protected removeAdmin(): void {
    if (!window.confirm('Gỡ quyền ADMIN? Các phiên hiện tại của tài khoản sẽ bị thu hồi.')) return;
    this.actionsStore.removeAdminRole().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }

  protected revokeSession(sessionId: string): void {
    if (!window.confirm('Thu hồi phiên đăng nhập này?')) return;
    this.runSecurityMutation(
      this.api.revokeSession(this.userId, sessionId),
      'Đã thu hồi phiên đăng nhập.',
    );
  }

  protected revokeAllSessions(): void {
    if (!window.confirm('Thu hồi toàn bộ phiên đăng nhập của người dùng này?')) return;
    this.runSecurityMutation(
      this.api.revokeAllSessions(this.userId),
      'Đã thu hồi toàn bộ phiên đăng nhập.',
    );
  }

  protected unlock(): void {
    if (
      !window.confirm(
        'Xóa trạng thái khóa đăng nhập tạm thời? Trạng thái tài khoản sẽ không thay đổi.',
      )
    )
      return;
    this.runSecurityMutation(
      this.api.unlock(this.userId),
      'Đã mở khóa đăng nhập tạm thời; lifecycle tài khoản được giữ nguyên.',
    );
  }

  protected formatDate(value: string | null): string {
    return value ? new Date(value).toLocaleString('vi-VN') : '—';
  }

  private submitStatus(status: ManagedUserStatus, reason?: string): void {
    this.actionsStore
      .updateStatus(status, reason)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.pendingStatus.set(null);
          this.statusReason = '';
          if (this.canReadSecurity()) this.loadSecurity();
        },
      });
  }

  private loadSecurity(): void {
    this.securityLoading.set(true);
    this.securityError.set('');
    this.api
      .listSessions(this.userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (sessions) => this.sessions.set(sessions),
        error: (error: unknown) => this.securityError.set(getApiErrorMessage(error)),
      });
    this.api
      .listSecurityEvents(this.userId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.securityLoading.set(false)),
      )
      .subscribe({
        next: (events) => this.securityEvents.set(events),
        error: (error: unknown) => this.securityError.set(getApiErrorMessage(error)),
      });
  }

  private runSecurityMutation(request: import('rxjs').Observable<unknown>, message: string): void {
    this.securityLoading.set(true);
    this.securityError.set('');
    this.securityMessage.set('');
    request
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.securityLoading.set(false)),
      )
      .subscribe({
        next: () => {
          this.securityMessage.set(message);
          this.detailStore.load(this.userId);
          this.loadSecurity();
        },
        error: (error: unknown) => this.securityError.set(getApiErrorMessage(error)),
      });
  }

  private hasPermission(permission: string): boolean {
    const expected = permission.toLowerCase();
    return Boolean(this.auth.user()?.permissions.some((item) => item.toLowerCase() === expected));
  }
}
