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

  template: `
    <main class="admin-page">
      <div class="page-container">
        <app-breadcrumb [items]="breadcrumbs" />

        <app-page-heading
          title="Quản lý người dùng"
          description="Tìm kiếm, kiểm tra trạng thái tài khoản và quản lý quyền quản trị."
          icon="users"
        />

        <section class="card">
          <header class="toolbar">
            <form class="search" (submit)="search($event)">
              <app-search-field
                [value]="store.keyword()"
                placeholder="Email, username hoặc tên hiển thị..."
                ariaLabel="Tìm người dùng"
                (valueChange)="store.setKeyword($event)"
              />

              <button type="submit">Tìm</button>
            </form>

            <select [value]="store.roleFilter()" (change)="changeRole($event)">
              <option value="ALL">Tất cả role</option>

              <option value="USER">User</option>

              <option value="AUTHOR">Author</option>

              <option value="ADMIN">Admin</option>
            </select>
          </header>

          <app-tab-filter
            class="status-tabs"
            ariaLabel="Trạng thái tài khoản"
            [options]="statusOptions"
            [selected]="store.statusFilter()"
            (selectedChange)="store.setStatusFilter($event)"
          />

          @if (store.listError()) {
            <div class="state">
              <app-error-alert
                title="Không thể tải người dùng"
                [message]="store.listError()"
                (retry)="store.loadList()"
              />
            </div>
          }

          @if (store.listLoading() && store.users().length === 0) {
            <app-loading-state message="Đang tải người dùng..." />
          } @else if (store.users().length === 0 && !store.listError()) {
            <app-empty-state
              icon="users"
              title="Không tìm thấy người dùng"
              description="Không có tài khoản phù hợp với bộ lọc hiện tại."
            />
          } @else {
            <div class="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Người dùng</th>

                    <th>Role</th>

                    <th>Email</th>

                    <th>Trạng thái</th>

                    <th>Đăng nhập gần nhất</th>

                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  @for (user of store.users(); track user.id) {
                    <tr>
                      <td>
                        <div class="identity">
                          <strong>
                            {{ user.displayName }}
                          </strong>

                          <small> &#64;{{ user.username }} </small>
                        </div>
                      </td>

                      <td>
                        <div class="roles">
                          @for (role of user.roles; track role.code) {
                            <span>
                              {{ role.code }}
                            </span>
                          }
                        </div>
                      </td>

                      <td>
                        <div class="email">
                          {{ user.email }}

                          @if (user.emailVerified) {
                            <small> ✓ đã xác minh </small>
                          }
                        </div>
                      </td>

                      <td>
                        <span
                          class="status"
                          [class.active]="user.status === 'ACTIVE'"
                          [class.suspended]="user.status === 'SUSPENDED'"
                          [class.banned]="user.status === 'BANNED'"
                          [class.deleted]="user.status === 'DELETED'"
                        >
                          {{ statusLabel(user.status) }}
                        </span>
                      </td>

                      <td>
                        {{ formatDate(user.lastLoginAt) }}
                      </td>

                      <td>
                        <a class="detail-link" [routerLink]="['/admin/users', user.id]">
                          Chi tiết
                        </a>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <footer class="pagination">
              <span>
                Tổng
                {{ store.total() }}
                người dùng
              </span>

              <app-pagination
                [page]="store.page()"
                [totalPages]="store.totalPages()"
                (pageChange)="store.setPage($event)"
              />
            </footer>
          }
        </section>
      </div>
    </main>
  `,

  styles: `
    :host {
      display: block;
    }

    .admin-page {
      min-height: calc(100vh - 72px);
      padding: 1.25rem 0 4rem;
      background: #060b16;
    }

    .card {
      overflow: hidden;
      border: 1px solid var(--border);
      border-radius: 14px;
      background: rgba(14, 21, 38, 0.88);
    }

    .toolbar {
      padding: 18px;
      display: flex;
      gap: 12px;
      justify-content: space-between;
      border-bottom: 1px solid var(--border);
    }

    .search {
      width: min(620px, 100%);
      display: flex;
      gap: 9px;
    }

    .search app-search-field {
      flex: 1;
    }

    button,
    select {
      min-height: 42px;
      border-radius: 8px;
      font: inherit;
    }

    button {
      padding: 0 18px;
      border: 0;
      color: #fff;
      font-weight: 700;
      cursor: pointer;
      background: linear-gradient(135deg, #743bde, #a153eb);
    }

    select {
      padding: 0 12px;
      border: 1px solid var(--border);
      outline: none;
      color: #cbd5e1;
      background: #0b1220;
    }

    .status-tabs {
      padding: 14px 18px;
      border-bottom: 1px solid var(--border);
    }

    .state {
      padding: 18px;
    }

    .table-scroll {
      overflow-x: auto;
    }

    table {
      width: 100%;
      min-width: 980px;
      border-collapse: collapse;
    }

    th,
    td {
      padding: 15px 18px;
      border-bottom: 1px solid var(--border);
      text-align: left;
    }

    th {
      color: #64748b;
      font-size: 11px;
      text-transform: uppercase;
    }

    td {
      color: #cbd5e1;
      font-size: 13px;
    }

    .identity,
    .email {
      display: grid;
      gap: 4px;
    }

    .identity strong {
      color: #f8fafc;
    }

    small {
      color: #64748b;
    }

    .roles {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
    }

    .roles span {
      padding: 4px 7px;
      border-radius: 999px;
      color: #c4b5fd;
      font-size: 10px;
      font-weight: 800;
      background: rgba(124, 58, 237, 0.13);
    }

    .status {
      padding: 5px 9px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
    }

    .status.active {
      color: #86efac;
      background: rgba(34, 197, 94, 0.13);
    }

    .status.suspended {
      color: #fde68a;
      background: rgba(245, 158, 11, 0.13);
    }

    .status.banned,
    .status.deleted {
      color: #fda4af;
      background: rgba(244, 63, 94, 0.13);
    }

    .detail-link {
      color: #c4b5fd;
      font-weight: 700;
      text-decoration: none;
    }

    .pagination {
      padding: 16px 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      color: #64748b;
      font-size: 12px;
    }

    @media (max-width: 700px) {
      .toolbar,
      .search,
      .pagination {
        flex-direction: column;
      }

      select {
        width: 100%;
      }
    }
  `,
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
