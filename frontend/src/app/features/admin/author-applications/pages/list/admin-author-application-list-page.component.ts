import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
} from '@angular/core';

import {
  BreadcrumbComponent,
  BreadcrumbItem,
} from '../../../../../shared/components/breadcrumb/breadcrumb.component';

import {
  EmptyStateComponent,
} from '../../../../../shared/components/empty-state/empty-state.component';

import {
  ErrorAlertComponent,
} from '../../../../../shared/components/error-alert/error-alert.component';

import {
  LoadingStateComponent,
} from '../../../../../shared/components/loading-state/loading-state.component';

import {
  PageHeadingComponent,
} from '../../../../../shared/components/page-heading/page-heading.component';

import {
  PaginationComponent,
} from '../../../../../shared/components/pagination/pagination.component';

import {
  SearchFieldComponent,
} from '../../../../../shared/components/search-field/search-field.component';

import {
  TabFilterComponent,
  TabFilterOption,
} from '../../../../../shared/components/tab-filter/tab-filter.component';

import {
  AdminAuthorApplicationsStore,
} from '../../data-access/admin-author-applications.store';

import {
  AdminAuthorApplicationStatusFilter,
} from '../../domain/admin-author-application.models';

import {
  AdminAuthorApplicationTableComponent,
} from '../../ui/admin-author-application-table.component';

@Component({
  selector:
    'app-admin-author-application-list-page',

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

  providers: [
    AdminAuthorApplicationsStore,
  ],

  changeDetection:
    ChangeDetectionStrategy.OnPush,

  template: `
    <main class="admin-page">
      <div class="page-container">
        <app-breadcrumb
          [items]="breadcrumbs"
        />

        <app-page-heading
          title="Xét duyệt hồ sơ tác giả"
          description="Quản lý và xét duyệt các yêu cầu trở thành tác giả trên hệ thống."
          icon="shield"
        />

        <section class="admin-card">
          <header class="toolbar">
            <form
              class="search-group"
              (submit)="
                handleSearchSubmit(
                  $event
                )
              "
            >
              <app-search-field
                class="search-field"
                [value]="
                  store.keyword()
                "
                placeholder="Tìm theo họ tên, bút danh hoặc email..."
                ariaLabel="Tìm hồ sơ tác giả"
                (valueChange)="
                  store.setKeyword(
                    $event
                  )
                "
              />

              <button
                type="submit"
                class="search-button"
              >
                Tìm kiếm
              </button>
            </form>

            <div class="summary">
              Tổng:
              <strong>
                {{ store.total() }}
              </strong>
              hồ sơ
            </div>
          </header>

          <app-tab-filter
            class="status-tabs"
            ariaLabel="Trạng thái hồ sơ"
            [options]="
              statusOptions
            "
            [selected]="
              store.statusFilter()
            "
            (selectedChange)="
              handleStatusChange(
                $event
              )
            "
          />

          @if (
            store.listError()
          ) {
            <div class="state-padding">
              <app-error-alert
                title="Không thể tải danh sách hồ sơ"
                [message]="
                  store.listError()
                "
                (retry)="
                  store.loadList()
                "
              />
            </div>
          }

          @if (
            store.listStatus() ===
              'loading' &&
            store.applications()
              .length === 0
          ) {
            <app-loading-state
              message="Đang tải danh sách hồ sơ..."
            />
          } @else if (
            store.applications()
              .length === 0 &&
            store.listStatus() !==
              'error'
          ) {
            <app-empty-state
              icon="users"
              title="Không có hồ sơ phù hợp"
              description="Không tìm thấy hồ sơ tác giả theo bộ lọc hiện tại."
            />
          } @else if (
            store.applications()
              .length > 0
          ) {
            <app-admin-author-application-table
              [applications]="
                store.applications()
              "
            />

            <footer
              class="list-footer"
            >
              <span>
                Trang
                {{ store.page() }}
                /
                {{
                  store.totalPages()
                }}
              </span>

              <app-pagination
                [page]="
                  store.page()
                "
                [totalPages]="
                  store.totalPages()
                "
                (pageChange)="
                  store.setPage(
                    $event
                  )
                "
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

      min-height: 100%;
    }

    .admin-page {
      min-height:
        calc(
          100vh - 72px
        );

      padding:
        1.25rem 0 4rem;

      color:
        var(--text-strong);

      background:
        radial-gradient(
          circle at 10% 5%,
          rgba(
            103,
            44,
            204,
            0.08
          ),
          transparent 480px
        ),
        #060b16;
    }

    .admin-card {
      overflow: hidden;

      border:
        1px solid
        var(--border);

      border-radius: 14px;

      background:
        rgba(
          14,
          21,
          38,
          0.86
        );
    }

    .toolbar {
      padding: 18px;

      display: flex;

      align-items: center;

      justify-content:
        space-between;

      gap: 16px;

      border-bottom:
        1px solid
        var(--border);
    }

    .search-group {
      width: min(
        600px,
        100%
      );

      display: flex;

      align-items: center;

      gap: 9px;
    }

    .search-field {
      flex: 1;

      --search-min-height:
        42px;
    }

    .search-button {
      min-height: 42px;

      padding: 0 16px;

      flex: 0 0 auto;

      border: 0;

      border-radius: 8px;

      color: #fff;

      font-weight: 700;

      cursor: pointer;

      background:
        linear-gradient(
          135deg,
          #743bde,
          #a153eb
        );
    }

    .summary {
      color: #7f899d;

      font-size: 13px;

      white-space: nowrap;
    }

    .summary strong {
      color: #e9d5ff;
    }

    .status-tabs {
      padding: 14px 18px;

      border-bottom:
        1px solid
        var(--border);

      --tab-min-height:
        34px;
    }

    .state-padding {
      padding: 18px;
    }

    .list-footer {
      padding:
        16px 18px;

      display: flex;

      align-items: center;

      justify-content:
        space-between;

      gap: 16px;

      color: #7f899d;

      font-size: 12px;
    }

    @media (
      max-width: 720px
    ) {
      .toolbar {
        align-items:
          stretch;

        flex-direction:
          column;
      }

      .search-group {
        width: 100%;
      }

      .summary {
        align-self:
          flex-end;
      }

      .list-footer {
        flex-direction:
          column;
      }
    }

    @media (
      max-width: 500px
    ) {
      .search-group {
        align-items:
          stretch;

        flex-direction:
          column;
      }
    }
  `,
})
export class AdminAuthorApplicationListPageComponent
  implements OnInit
{
  protected readonly store =
    inject(
      AdminAuthorApplicationsStore,
    );

  protected readonly breadcrumbs:
    readonly BreadcrumbItem[] = [
      {
        label: 'Trang chủ',

        route: '/',
      },

      {
        label: 'Quản trị',
      },

      {
        label:
          'Hồ sơ tác giả',
      },
    ];

  protected readonly statusOptions:
    readonly TabFilterOption<AdminAuthorApplicationStatusFilter>[] =
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

  protected handleStatusChange(
    status:
      AdminAuthorApplicationStatusFilter,
  ): void {
    this.store.setStatusFilter(
      status,
    );
  }

  protected handleSearchSubmit(
    event: Event,
  ): void {
    event.preventDefault();

    this.store.search();
  }
}
