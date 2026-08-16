import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { debounceTime, Subject } from 'rxjs';

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
import { ManagedUserRoleFilter, ManagedUserStatusFilter } from '../../domain/admin-user.models';
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
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly keywordChanges = new Subject<void>();
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
    this.keywordChanges
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.syncUrl(1));

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const status = (params.get('status') ?? 'ALL') as ManagedUserStatusFilter;
      const role = (params.get('role') ?? 'ALL') as ManagedUserRoleFilter;
      this.store.hydrate({
        keyword: params.get('search') ?? '',
        status,
        role,
        page: Math.max(1, Number(params.get('page') ?? 1) || 1),
      });
    });
  }

  protected keywordChanged(value: string): void {
    this.store.setKeyword(value);
    this.keywordChanges.next();
  }

  protected statusChanged(value: ManagedUserStatusFilter): void {
    this.store.statusFilter.set(value);
    this.syncUrl(1);
  }

  protected roleChanged(value: ManagedUserRoleFilter): void {
    this.store.roleFilter.set(value);
    this.syncUrl(1);
  }

  protected pageChanged(page: number): void {
    this.syncUrl(page);
  }

  protected submitSearch(): void {
    this.syncUrl(1);
  }

  private syncUrl(page: number): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        search: this.store.keyword().trim() || null,
        status: this.store.statusFilter() === 'ALL' ? null : this.store.statusFilter(),
        role: this.store.roleFilter() === 'ALL' ? null : this.store.roleFilter(),
        page: Math.max(1, page),
      },
    });
  }
}
