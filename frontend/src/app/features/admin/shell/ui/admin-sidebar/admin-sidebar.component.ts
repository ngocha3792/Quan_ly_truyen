import {
  ChangeDetectionStrategy,
  Component,
  computed,
  EventEmitter,
  inject,
  Output,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { AuthStore } from '../../../../../core/auth/auth.store';
import { AUTH_PERMISSIONS, AuthPermission } from '../../../../../core/auth/authorization.models';
import { APP_NAME } from '../../../../../core/config/app-identity.constants';
import { IconComponent, IconName } from '../../../../../shared/components/icon/icon.component';

interface AdminNavigationItem {
  readonly label: string;
  readonly route: string;
  readonly icon: IconName;
  readonly permission: AuthPermission;
}

const NAVIGATION_ITEMS: readonly AdminNavigationItem[] = [
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
];

@Component({
  selector: 'app-admin-sidebar',
  standalone: true,

  imports: [RouterLink, RouterLinkActive, IconComponent],

  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './admin-sidebar.component.html',

  styleUrl: './admin-sidebar.component.scss',
})
export class AdminSidebarComponent {
  private readonly authStore = inject(AuthStore);

  protected readonly appName = APP_NAME;
  protected readonly user = this.authStore.user;

  @Output()
  readonly navigated = new EventEmitter<void>();

  protected readonly navigationItems = computed(() => {
    const permissions = new Set(this.user()?.permissions ?? []);
    return NAVIGATION_ITEMS.filter((item) => permissions.has(item.permission));
  });

  protected initial(displayName: string): string {
    return displayName.trim().charAt(0).toUpperCase() || '?';
  }
}
