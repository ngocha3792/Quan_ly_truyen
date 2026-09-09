import {
  ChangeDetectionStrategy,
  Component,
  computed,
  EventEmitter,
  inject,
  Output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { APP_RUNTIME_CONFIG } from '../../../../../core/config/app-config.token';

import { AuthStore } from '../../../../../core/auth/auth.store';
import { AUTH_PERMISSIONS, AuthPermission } from '../../../../../core/auth/authorization.models';
import { IconComponent, IconName } from '../../../../../shared/components/icon/icon.component';
import {
  ShellNavigationItem,
  ShellSidebarComponent,
} from '../../../../../shared/components/shell-sidebar/shell-sidebar.component';

interface AdminNavigationItem extends ShellNavigationItem {
  readonly icon: IconName;
  readonly permission: AuthPermission;
  readonly requiresMonetization?: boolean;
}

const NAVIGATION_ITEMS: readonly AdminNavigationItem[] = [
  {
    label: 'Duyệt chương',
    route: '/admin/chapter-reviews',
    icon: 'chapter',
    permission: AUTH_PERMISSIONS.CHAPTER_MANAGE_ANY,
  },
  {
    label: 'Người dùng',
    route: '/admin/users',
    icon: 'users',
    permission: AUTH_PERMISSIONS.USER_MANAGE,
  },
  {
    label: 'Duyệt truyện',
    route: '/admin/stories',
    icon: 'book-open',
    permission: AUTH_PERMISSIONS.STORY_REVIEW,
  },
  {
    label: 'Tác giả',
    route: '/admin/authors',
    icon: 'user',
    permission: AUTH_PERMISSIONS.AUTHOR_READ,
  },
  {
    label: 'Hồ sơ chờ duyệt',
    route: '/admin/author-applications',
    icon: 'graduation-cap',
    permission: AUTH_PERMISSIONS.AUTHOR_APPLICATION_REVIEW,
  },
  {
    label: 'Báo cáo',
    route: '/admin/reports',
    icon: 'alert-triangle',
    permission: AUTH_PERMISSIONS.REPORT_REVIEW,
  },
  {
    label: 'Thể loại',
    route: '/admin/categories',
    icon: 'grid',
    permission: AUTH_PERMISSIONS.CATEGORY_MANAGE,
  },
  { label: 'Tag', route: '/admin/tags', icon: 'bookmark', permission: AUTH_PERMISSIONS.TAG_MANAGE },
  {
    label: 'Audit log',
    route: '/admin/audit-logs',
    icon: 'history',
    permission: AUTH_PERMISSIONS.AUDIT_LOG_READ,
  },
  {
    label: 'Vận hành Credit',
    route: '/admin/monetization',
    icon: 'wallet',
    permission: AUTH_PERMISSIONS.PAYMENT_READ_ADMIN,
    requiresMonetization: true,
  },
  {
    label: 'Trợ lý AI',
    route: '/admin/settings/ai',
    icon: 'sparkles',
    permission: AUTH_PERMISSIONS.AI_SETTINGS_MANAGE,
  },
  {
    label: 'Phương thức thanh toán',
    route: '/admin/settings/payments',
    icon: 'wallet',
    permission: AUTH_PERMISSIONS.PAYMENT_PROVIDER_MANAGE_ADMIN,
  },
  {
    label: 'Duyệt chuyển khoản',
    route: '/admin/payments/review',
    icon: 'history',
    permission: AUTH_PERMISSIONS.PAYMENT_ORDER_SETTLE_ADMIN,
    requiresMonetization: true,
  },
];

@Component({
  selector: 'app-admin-sidebar',
  standalone: true,

  imports: [RouterLink, IconComponent, ShellSidebarComponent],

  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './admin-sidebar.component.html',

  styleUrl: './admin-sidebar.component.scss',
})
export class AdminSidebarComponent {
  private readonly authStore = inject(AuthStore);
  private readonly config = inject(APP_RUNTIME_CONFIG);

  protected readonly user = this.authStore.user;

  @Output()
  readonly navigated = new EventEmitter<void>();

  protected readonly navigationItems = computed(() => {
    const permissions = new Set(this.user()?.permissions ?? []);
    return NAVIGATION_ITEMS.filter(
      (item) =>
        permissions.has(item.permission) &&
        (!item.requiresMonetization || this.config.features.monetizationEnabled),
    );
  });

  protected initial(displayName: string): string {
    return displayName.trim().charAt(0).toUpperCase() || '?';
  }
}
