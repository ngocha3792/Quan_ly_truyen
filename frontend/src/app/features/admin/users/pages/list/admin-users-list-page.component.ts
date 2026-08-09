import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';

import { RouterLink } from '@angular/router';

import {
  BreadcrumbComponent,
  BreadcrumbItem,
} from '../../../../../shared/components/breadcrumb/breadcrumb.component';

import { EmptyStateComponent } from '../../../../../shared/components/empty-state/empty-state.component';

import { ErrorAlertComponent } from '../../../../../shared/components/error-alert/error-alert.component';

import { LoadingStateComponent } from '../../../../../shared/components/loading-state/loading-state.component';

import { PageHeadingComponent } from '../../../../../shared/components/page-heading/page-heading.component';

import { PaginationComponent } from '../../../../../shared/components/pagination/pagination.component';

import { SearchFieldComponent } from '../../../../../shared/components/search-field/search-field.component';

import {
  TabFilterComponent,
  TabFilterOption,
} from '../../../../../shared/components/tab-filter/tab-filter.component';

import { AdminUsersStore } from '../../data-access/admin-users.store';

import { ManagedUserRoleFilter, ManagedUserStatusFilter } from '../../domain/admin-user.models';

@Component({
  selector: 'app-admin-users-list-page',

  standalone: true,

  imports: [
    RouterLink,

    BreadcrumbComponent,

    EmptyStateComponent,

    ErrorAlertComponent,

    LoadingStateComponent,

    PageHeadingComponent,

    PaginationComponent,

    SearchFieldComponent,

    TabFilterComponent,
  ],

  providers: [AdminUsersStore],

  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './admin-users-list-page.component.html',

  styleUrl: './admin-users-list-page.component.scss',
})
export class AdminUsersListPageComponent implements OnInit {
  protected readonly store = inject(AdminUsersStore);

  protected readonly breadcrumbs: readonly BreadcrumbItem[] = [
    {
      label: 'Trang chủ',

      route: '/',
    },

    {
      label: 'Quản trị',
    },

    {
      label: 'Người dùng',
    },
  ];

  protected readonly statusOptions: readonly TabFilterOption<ManagedUserStatusFilter>[] = [
    {
      value: 'ALL',

      label: 'Tất cả',
    },

    {
      value: 'ACTIVE',

      label: 'Hoạt động',
    },

    {
      value: 'SUSPENDED',

      label: 'Tạm khóa',
    },

    {
      value: 'BANNED',

      label: 'Bị cấm',
    },

    {
      value: 'DELETED',

      label: 'Đã xóa',
    },
  ];

  ngOnInit(): void {
    this.store.loadList();
  }

  protected search(event: Event): void {
    event.preventDefault();

    this.store.search();
  }

  protected changeRole(event: Event): void {
    const target = event.target as HTMLSelectElement;

    this.store.setRoleFilter(target.value as ManagedUserRoleFilter);
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
