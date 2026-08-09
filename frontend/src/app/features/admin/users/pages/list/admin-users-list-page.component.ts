import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';

import {
  BreadcrumbComponent,
  BreadcrumbItem,
} from '../../../../../shared/components/breadcrumb/breadcrumb.component';
import { EmptyStateComponent } from '../../../../../shared/components/empty-state/empty-state.component';
import { ErrorAlertComponent } from '../../../../../shared/components/error-alert/error-alert.component';
import { LoadingStateComponent } from '../../../../../shared/components/loading-state/loading-state.component';
import { PageHeadingComponent } from '../../../../../shared/components/page-heading/page-heading.component';
import { TabFilterOption } from '../../../../../shared/components/tab-filter/tab-filter.component';
import { AdminUsersListStore } from '../../data-access/admin-users-list.store';
import { ManagedUserStatusFilter } from '../../domain/admin-user.models';
import { AdminUsersFiltersComponent } from '../../ui/admin-users-filters.component';
import { AdminUsersTableComponent } from '../../ui/admin-users-table.component';

@Component({
  selector: 'app-admin-users-list-page',
  standalone: true,
  imports: [
    BreadcrumbComponent,
    EmptyStateComponent,
    ErrorAlertComponent,
    LoadingStateComponent,
    PageHeadingComponent,
    AdminUsersFiltersComponent,
    AdminUsersTableComponent,
  ],
  providers: [AdminUsersListStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-users-list-page.component.html',
  styleUrl: './admin-users-list-page.component.scss',
})
export class AdminUsersListPageComponent implements OnInit {
  protected readonly store = inject(AdminUsersListStore);
  protected readonly breadcrumbs: readonly BreadcrumbItem[] = [
    { label: 'Trang chủ', route: '/' },
    { label: 'Quản trị' },
    { label: 'Người dùng' },
  ];
  protected readonly statusOptions: readonly TabFilterOption<ManagedUserStatusFilter>[] = [
    { value: 'ALL', label: 'Tất cả' },
    { value: 'ACTIVE', label: 'Hoạt động' },
    { value: 'SUSPENDED', label: 'Tạm khóa' },
    { value: 'BANNED', label: 'Bị cấm' },
    { value: 'DELETED', label: 'Đã xóa' },
  ];
  ngOnInit(): void {
    this.store.load();
  }
}
