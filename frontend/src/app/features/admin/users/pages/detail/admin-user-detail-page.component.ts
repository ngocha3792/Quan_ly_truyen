import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
} from '@angular/core';

import {
  takeUntilDestroyed,
} from '@angular/core/rxjs-interop';

import {
  ActivatedRoute,
  RouterLink,
} from '@angular/router';

import {
  AuthStore,
} from '../../../../../core/auth/auth.store';

import {
  AUTH_PERMISSIONS,
} from '../../../../../core/auth/authorization.models';

import {
  BreadcrumbComponent,
  BreadcrumbItem,
} from '../../../../../shared/components/breadcrumb/breadcrumb.component';

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
  AdminUsersStore,
} from '../../data-access/admin-users.store';

import {
  ManagedUserStatus,
} from '../../domain/admin-user.models';

@Component({
  selector:
    'app-admin-user-detail-page',

  standalone:
    true,

  imports: [
    RouterLink,

    BreadcrumbComponent,

    ErrorAlertComponent,

    LoadingStateComponent,

    PageHeadingComponent,
  ],

  providers: [
    AdminUsersStore,
  ],

  changeDetection:
    ChangeDetectionStrategy.OnPush,

  template: `
    <main class="admin-page">
      <div class="page-container">
        <app-breadcrumb
          [items]="breadcrumbs()"
        />

        <app-page-heading
          title="Chi tiết người dùng"
          description="Quản lý trạng thái tài khoản, phiên đăng nhập và quyền quản trị."
          icon="users"
        >
          <a
            routerLink="/admin/users"
            class="back"
          >
            ← Danh sách người dùng
          </a>
        </app-page-heading>

        @if (
          store.detailLoading()
        ) {
          <app-loading-state
            message="Đang tải thông tin người dùng..."
          />
        } @else if (
          store.detailError()
        ) {
          <app-error-alert
            title="Không thể tải người dùng"
            [message]="
              store.detailError()
            "
            (retry)="
              store.loadDetail(
                userId
              )
            "
          />
        } @else if (
          store.detail();
          as user
        ) {
          @if (
            store.actionMessage()
          ) {
            <div class="success">
              {{
                store.actionMessage()
              }}
            </div>
          }

          @if (
            store.actionError()
          ) {
            <div class="error">
              {{
                store.actionError()
              }}
            </div>
          }

          <section class="hero">
            <div class="user-heading">
              @if (
                user.avatar?.url
              ) {
                <img
                  [src]="user.avatar!.url!"
                  [alt]="user.displayName"
                />
              } @else {
                <div class="avatar">
                  {{
                    user.displayName
                      .charAt(0)
                      .toUpperCase()
                  }}
                </div>
              }

              <div>
                <h2>
                  {{
                    user.displayName
                  }}
                </h2>

                <p>
                  &#64;{{
                    user.username
                  }}
                  ·
                  {{
                    user.email
                  }}
                </p>

                <div class="badges">
                  <span
                    class="status"
                    [class.active]="
                      user.status ===
                      'ACTIVE'
                    "
                    [class.warning]="
                      user.status ===
                      'SUSPENDED'
                    "
                    [class.danger]="
                      user.status ===
                        'BANNED' ||
                      user.status ===
                        'DELETED'
                    "
                  >
                    {{
                      statusLabel(
                        user.status
                      )
                    }}
                  </span>

                  @for (
                    role of user.roles;
                    track role.code
                  ) {
                    <span class="role">
                      {{
                        role.code
                      }}
                    </span>
                  }
                </div>
              </div>
            </div>

            @if (
              !isSelf() &&
              user.status !==
                'DELETED'
            ) {
              <div class="status-actions">
                @if (
                  user.status !==
                  'ACTIVE'
                ) {
                  <button
                    type="button"
                    class="activate"
                    [disabled]="
                      store.actionLoading()
                    "
                    (click)="
                      changeStatus(
                        'ACTIVE'
                      )
                    "
                  >
                    Kích hoạt
                  </button>
                }

                @if (
                  user.status ===
                  'ACTIVE'
                ) {
                  <button
                    type="button"
                    class="suspend"
                    [disabled]="
                      store.actionLoading()
                    "
                    (click)="
                      changeStatus(
                        'SUSPENDED'
                      )
                    "
                  >
                    Tạm khóa
                  </button>

                  <button
                    type="button"
                    class="ban"
                    [disabled]="
                      store.actionLoading()
                    "
                    (click)="
                      changeStatus(
                        'BANNED'
                      )
                    "
                  >
                    Cấm tài khoản
                  </button>
                }
              </div>
            }
          </section>

          @if (isSelf()) {
            <div class="notice">
              Đây là tài khoản của bạn.
              Hệ thống không cho phép
              tự khóa/ban hoặc tự gỡ
              quyền ADMIN.
            </div>
          }

          <div class="grid">
            <section class="card">
              <h3>
                Thông tin tài khoản
              </h3>

              <dl>
                <div>
                  <dt>
                    User ID
                  </dt>

                  <dd>
                    {{ user.id }}
                  </dd>
                </div>

                <div>
                  <dt>
                    Email
                  </dt>

                  <dd>
                    {{ user.email }}
                  </dd>
                </div>

                <div>
                  <dt>
                    Xác minh email
                  </dt>

                  <dd>
                    {{
                      user.emailVerified
                        ? 'Đã xác minh'
                        : 'Chưa xác minh'
                    }}
                  </dd>
                </div>

                <div>
                  <dt>
                    Tạo tài khoản
                  </dt>

                  <dd>
                    {{
                      formatDate(
                        user.createdAt
                      )
                    }}
                  </dd>
                </div>

                <div>
                  <dt>
                    Đăng nhập cuối
                  </dt>

                  <dd>
                    {{
                      formatDate(
                        user.lastLoginAt
                      )
                    }}
                  </dd>
                </div>

                <div>
                  <dt>
                    Session đang hoạt động
                  </dt>

                  <dd>
                    {{
                      user.activeSessionCount
                    }}
                  </dd>
                </div>
              </dl>
            </section>

            <section class="card">
              <h3>
                Hồ sơ
              </h3>

              <p class="bio">
                {{
                  user.bio ||
                    'Người dùng chưa có tiểu sử.'
                }}
              </p>

              @if (
                user.authorProfile
              ) {
                <div class="author-box">
                  <span>
                    Author profile
                  </span>

                  <strong>
                    {{
                      user.authorProfile
                        .penName
                    }}
                  </strong>

                  <small>
                    {{
                      user.authorProfile
                        .verificationStatus
                    }}
                  </small>
                </div>
              }
            </section>
          </div>

          <section class="card roles-card">
            <div class="section-heading">
              <div>
                <h3>
                  Roles
                </h3>

                <p>
                  USER là role nền.
                  AUTHOR được quản lý bởi
                  Author Application.
                  Chỉ ADMIN được cấp/gỡ
                  tại đây.
                </p>
              </div>
            </div>

            <div class="role-list">
              @for (
                role of user.roles;
                track role.code
              ) {
                <article>
                  <div>
                    <strong>
                      {{
                        role.code
                      }}
                    </strong>

                    <span>
                      {{ role.name }}
                    </span>
                  </div>

                  <small>
                    Cấp:
                    {{
                      formatDate(
                        role.assignedAt
                      )
                    }}
                  </small>
                </article>
              }
            </div>

            @if (
              canManageRoles()
            ) {
              <footer class="role-actions">
                @if (
                  hasRole('ADMIN')
                ) {
                  <button
                    type="button"
                    class="remove-admin"
                    [disabled]="
                      store.actionLoading() ||
                      isSelf()
                    "
                    (click)="
                      removeAdmin()
                    "
                  >
                    Gỡ quyền ADMIN
                  </button>
                } @else {
                  <button
                    type="button"
                    class="grant-admin"
                    [disabled]="
                      store.actionLoading() ||
                      user.status ===
                        'DELETED'
                    "
                    (click)="
                      grantAdmin()
                    "
                  >
                    Cấp quyền ADMIN
                  </button>
                }
              </footer>
            } @else {
              <div class="notice">
                Tài khoản quản trị hiện
                tại không có permission
                role.manage.
              </div>
            }
          </section>
        }
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

    .back {
      color: #a78bfa;
      font-weight: 700;
      text-decoration: none;
    }

    .success,
    .error,
    .notice {
      margin-bottom: 16px;
      padding: 12px 15px;
      border-radius: 8px;
      font-size: 13px;
    }

    .success {
      color: #86efac;
      background: rgba(34, 197, 94, 0.09);
    }

    .error {
      color: #fda4af;
      background: rgba(244, 63, 94, 0.09);
    }

    .notice {
      color: #fde68a;
      background: rgba(245, 158, 11, 0.08);
    }

    .hero,
    .card {
      margin-bottom: 18px;
      padding: 20px;
      border: 1px solid var(--border);
      border-radius: 14px;
      background: rgba(14, 21, 38, 0.88);
    }

    .hero {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
    }

    .user-heading {
      display: flex;
      align-items: center;
      gap: 15px;
    }

    .user-heading img,
    .avatar {
      width: 58px;
      height: 58px;
      flex: 0 0 auto;
      border-radius: 50%;
    }

    .user-heading img {
      object-fit: cover;
    }

    .avatar {
      display: grid;
      place-items: center;
      color: #fff;
      font-size: 22px;
      font-weight: 900;
      background: linear-gradient(135deg, #743bde, #a153eb);
    }

    h2,
    h3 {
      margin: 0;
      color: #f8fafc;
    }

    .user-heading p {
      margin: 5px 0 0;
      color: #64748b;
    }

    .badges {
      margin-top: 9px;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .status,
    .role {
      padding: 4px 8px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 800;
    }

    .status.active {
      color: #86efac;
      background: rgba(34, 197, 94, 0.13);
    }

    .status.warning {
      color: #fde68a;
      background: rgba(245, 158, 11, 0.13);
    }

    .status.danger {
      color: #fda4af;
      background: rgba(244, 63, 94, 0.13);
    }

    .role {
      color: #c4b5fd;
      background: rgba(124, 58, 237, 0.13);
    }

    .status-actions,
    .role-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 9px;
    }

    button {
      min-height: 39px;
      padding: 0 15px;
      border-radius: 8px;
      font-weight: 700;
      cursor: pointer;
    }

    button:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    .activate,
    .grant-admin {
      border: 0;
      color: #fff;
      background: #16a34a;
    }

    .suspend {
      border: 1px solid rgba(245, 158, 11, 0.35);
      color: #fde68a;
      background: rgba(245, 158, 11, 0.08);
    }

    .ban,
    .remove-admin {
      border: 1px solid rgba(244, 63, 94, 0.35);
      color: #fda4af;
      background: rgba(244, 63, 94, 0.08);
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 18px;
    }

    .grid .card {
      margin-bottom: 0;
    }

    .card h3 {
      margin-bottom: 16px;
    }

    dl {
      margin: 0;
      display: grid;
      gap: 13px;
    }

    dl div {
      display: grid;
      gap: 3px;
    }

    dt {
      color: #64748b;
      font-size: 11px;
      text-transform: uppercase;
    }

    dd {
      margin: 0;
      color: #e2e8f0;
      font-size: 13px;
      word-break: break-word;
    }

    .bio {
      color: #94a3b8;
      line-height: 1.7;
      white-space: pre-wrap;
    }

    .author-box {
      margin-top: 16px;
      padding: 13px;
      display: grid;
      gap: 4px;
      border-radius: 8px;
      background: rgba(124, 58, 237, 0.08);
    }

    .author-box span,
    .author-box small {
      color: #64748b;
      font-size: 11px;
    }

    .author-box strong {
      color: #c4b5fd;
    }

    .roles-card {
      margin-top: 18px;
    }

    .section-heading p {
      margin: 6px 0 0;
      color: #64748b;
      line-height: 1.6;
      font-size: 12px;
    }

    .role-list {
      margin-top: 18px;
      display: grid;
      gap: 8px;
    }

    .role-list article {
      padding: 12px;
      display: flex;
      justify-content: space-between;
      gap: 16px;
      border-radius: 8px;
      background: rgba(2, 6, 23, 0.35);
    }

    .role-list article div {
      display: grid;
      gap: 3px;
    }

    .role-list strong {
      color: #e9d5ff;
    }

    .role-list span,
    .role-list small {
      color: #64748b;
      font-size: 11px;
    }

    .role-actions {
      margin-top: 18px;
    }

    @media (max-width: 760px) {
      .hero,
      .grid {
        display: flex;
        align-items: stretch;
        flex-direction: column;
      }
    }
  `,
})
export class AdminUserDetailPageComponent
  implements OnInit
{
  private readonly route =
    inject(
      ActivatedRoute,
    );

  private readonly auth =
    inject(
      AuthStore,
    );

  private readonly destroyRef =
    inject(
      DestroyRef,
    );

  protected readonly store =
    inject(
      AdminUsersStore,
    );

  protected readonly userId =
    this.route.snapshot.paramMap.get(
      'userId',
    ) ?? '';

  protected readonly isSelf =
    computed(
      () =>
        this.auth.user()
          ?.id ===
        this.store.detail()?.id,
    );

  protected readonly canManageRoles =
    computed(() => {
      const user = this.auth.user();

      if (!user) {
        return false;
      }

      const targetPermission = AUTH_PERMISSIONS.ROLE_MANAGE.toLowerCase();

      return user.permissions.some(
        (permission) => permission.toLowerCase() === targetPermission,
      );
    });

  protected readonly breadcrumbs =
    computed<
      readonly BreadcrumbItem[]
    >(() => [
      {
        label:
          'Trang chủ',

        route:
          '/',
      },

      {
        label:
          'Quản trị',
      },

      {
        label:
          'Người dùng',

        route:
          '/admin/users',
      },

      {
        label:
          this.store.detail()
            ?.displayName ??
          'Chi tiết',
      },
    ]);

  ngOnInit(): void {
    if (this.userId) {
      this.store.loadDetail(
        this.userId,
      );
    }
  }

  protected changeStatus(
    status: ManagedUserStatus,
  ): void {
    this.store
      .updateStatus(
        status,
      )
      .pipe(
        takeUntilDestroyed(
          this.destroyRef,
        ),
      )
      .subscribe();
  }

  protected grantAdmin(): void {
    this.store
      .assignAdminRole()
      .pipe(
        takeUntilDestroyed(
          this.destroyRef,
        ),
      )
      .subscribe();
  }

  protected removeAdmin(): void {
    this.store
      .removeAdminRole()
      .pipe(
        takeUntilDestroyed(
          this.destroyRef,
        ),
      )
      .subscribe();
  }

  protected hasRole(
    code: string,
  ): boolean {
    const user =
      this.store.detail();

    if (!user) {
      return false;
    }

    return user.roles.some(
      (role) =>
        role.code === code,
    );
  }

  protected statusLabel(
    status: string,
  ): string {
    switch (
      status
    ) {
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

  protected formatDate(
    value:
      string | null,
  ): string {
    return value
      ? new Date(
          value,
        ).toLocaleString(
          'vi-VN',
        )
      : 'Chưa có';
  }
}
