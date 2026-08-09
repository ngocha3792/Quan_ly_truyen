import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';

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

import { AdminAuthorApplicationsStore } from '../../data-access/admin-author-applications.store';

import { AdminAuthorApplicationStatusFilter } from '../../domain/admin-author-application.models';

import { AdminAuthorApplicationTableComponent } from '../../ui/admin-author-application-table.component';

@Component({
  selector: 'app-admin-author-application-list-page',

  standalone: true,

  imports: [
    BreadcrumbComponent,
    PageHeadingComponent,
    SearchFieldComponent,
    TabFilterComponent,
    PaginationComponent,
    LoadingStateComponent,
    ErrorAlertComponent,
    EmptyStateComponent,
    AdminAuthorApplicationTableComponent,
  ],

  providers: [AdminAuthorApplicationsStore],

  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './admin-author-application-list-page.component.html',

  styleUrl: './admin-author-application-list-page.component.scss',
})
export class AdminAuthorApplicationListPageComponent implements OnInit {
  protected readonly store = inject(AdminAuthorApplicationsStore);

  protected readonly breadcrumbs: readonly BreadcrumbItem[] = [
    {
      label: 'Trang chủ',

      route: '/',
    },

    {
      label: 'Quản trị',
    },

    {
      label: 'Hồ sơ tác giả',
    },
  ];

  protected readonly statusOptions: readonly TabFilterOption<AdminAuthorApplicationStatusFilter>[] =
    [
      {
        value: 'PENDING',

        label: 'Chờ duyệt',
      },

      {
        value: 'ALL',

        label: 'Tất cả',
      },

      {
        value: 'APPROVED',

        label: 'Đã duyệt',
      },

      {
        value: 'REJECTED',

        label: 'Từ chối',
      },

      {
        value: 'DRAFT',

        label: 'Bản nháp',
      },
    ];

  ngOnInit(): void {
    this.store.loadList();
  }

  protected handleStatusChange(status: AdminAuthorApplicationStatusFilter): void {
    this.store.setStatusFilter(status);
  }

  protected handleSearchSubmit(event: Event): void {
    event.preventDefault();

    this.store.search();
  }
}
