import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  signal,
} from '@angular/core';

import {
  takeUntilDestroyed,
} from '@angular/core/rxjs-interop';

import {
  catchError,
  finalize,
  Observable,
  takeUntil,
  tap,
  throwError,
} from 'rxjs';

import {
  AuthSessionLifecycleService,
} from '../../../../core/auth/auth-session-lifecycle.service';

import {
  getApiErrorMessage,
} from '../../../../core/http/api-error.util';

import {
  AdminUserDetail,
  AdminUserSummary,
  ManagedUserRoleFilter,
  ManagedUserStatus,
  ManagedUserStatusFilter,
} from '../domain/admin-user.models';

import {
  AdminUsersApiService,
} from './admin-users-api.service';

@Injectable()
export class AdminUsersStore {
  private readonly api =
    inject(
      AdminUsersApiService,
    );

  private readonly lifecycle =
    inject(
      AuthSessionLifecycleService,
    );

  private readonly destroyRef =
    inject(
      DestroyRef,
    );

  private readonly usersState =
    signal<
      readonly AdminUserSummary[]
    >([]);

  private readonly totalState =
    signal(0);

  private readonly detailState =
    signal<AdminUserDetail | null>(
      null,
    );

  readonly users =
    this.usersState.asReadonly();

  readonly total =
    this.totalState.asReadonly();

  readonly detail =
    this.detailState.asReadonly();

  readonly keyword =
    signal('');

  readonly statusFilter =
    signal<ManagedUserStatusFilter>(
      'ALL',
    );

  readonly roleFilter =
    signal<ManagedUserRoleFilter>(
      'ALL',
    );

  readonly page =
    signal(1);

  readonly pageSize =
    20;

  readonly listLoading =
    signal(false);

  readonly detailLoading =
    signal(false);

  readonly actionLoading =
    signal(false);

  readonly listError =
    signal('');

  readonly detailError =
    signal('');

  readonly actionError =
    signal('');

  readonly actionMessage =
    signal('');

  readonly totalPages =
    computed(
      () =>
        Math.max(
          1,

          Math.ceil(
            this.total() /
              this.pageSize,
          ),
        ),
    );

  constructor() {
    this.lifecycle.changes$
      .pipe(
        takeUntilDestroyed(
          this.destroyRef,
        ),
      )
      .subscribe(
        () => {
          this.reset();
        },
      );
  }

  setKeyword(
    value: string,
  ): void {
    this.keyword.set(
      value,
    );
  }

  search(): void {
    this.page.set(1);

    this.loadList();
  }

  setStatusFilter(
    value:
      ManagedUserStatusFilter,
  ): void {
    this.statusFilter.set(
      value,
    );

    this.page.set(1);

    this.loadList();
  }

  setRoleFilter(
    value:
      ManagedUserRoleFilter,
  ): void {
    this.roleFilter.set(
      value,
    );

    this.page.set(1);

    this.loadList();
  }

  setPage(
    value: number,
  ): void {
    const page =
      Math.min(
        this.totalPages(),

        Math.max(
          1,

          Math.trunc(
            value,
          ),
        ),
      );

    this.page.set(
      page,
    );

    this.loadList();
  }

  loadList(): void {
    const revision =
      this.lifecycle.revision();

    this.listLoading.set(
      true,
    );

    this.listError.set('');

    this.api
      .list({
        keyword:
          this.keyword(),

        status:
          this.statusFilter(),

        role:
          this.roleFilter(),

        offset:
          (
            this.page() -
            1
          ) *
          this.pageSize,

        limit:
          this.pageSize,
      })
      .pipe(
        takeUntil(
          this.lifecycle.changes$,
        ),

        takeUntilDestroyed(
          this.destroyRef,
        ),

        finalize(
          () => {
            if (
              revision ===
              this.lifecycle.revision()
            ) {
              this.listLoading.set(
                false,
              );
            }
          },
        ),
      )
      .subscribe({
        next: (
          response,
        ) => {
          if (
            revision !==
            this.lifecycle.revision()
          ) {
            return;
          }

          this.usersState.set(
            response.users,
          );

          this.totalState.set(
            response.total,
          );
        },

        error: (
          error: unknown,
        ) => {
          if (
            revision !==
            this.lifecycle.revision()
          ) {
            return;
          }

          this.listError.set(
            getApiErrorMessage(
              error,
            ),
          );
        },
      });
  }

  loadDetail(
    userId: string,
  ): void {
    const revision =
      this.lifecycle.revision();

    this.detailLoading.set(
      true,
    );

    this.detailError.set('');

    this.actionError.set('');

    this.actionMessage.set('');

    this.api
      .getOne(
        userId,
      )
      .pipe(
        takeUntil(
          this.lifecycle.changes$,
        ),

        takeUntilDestroyed(
          this.destroyRef,
        ),

        finalize(
          () => {
            if (
              revision ===
              this.lifecycle.revision()
            ) {
              this.detailLoading.set(
                false,
              );
            }
          },
        ),
      )
      .subscribe({
        next: (
          user,
        ) => {
          if (
            revision ===
            this.lifecycle.revision()
          ) {
            this.detailState.set(
              user,
            );
          }
        },

        error: (
          error: unknown,
        ) => {
          if (
            revision !==
            this.lifecycle.revision()
          ) {
            this.detailError.set(
              getApiErrorMessage(
                error,
              ),
            );
          }
        },
      });
  }

  updateStatus(
    status:
      ManagedUserStatus,
  ): Observable<AdminUserDetail> {
    const user =
      this.detail();

    if (!user) {
      return throwError(
        () =>
          new Error(
            'Không có người dùng để cập nhật.',
          ),
      );
    }

    this.prepareAction();

    return this.api
      .updateStatus(
        user.id,

        status,
      )
      .pipe(
        tap(
          (
            updated,
          ) => {
            this.applyUpdatedUser(
              updated,
            );

            this.actionMessage.set(
              status ===
                'ACTIVE'
                ? 'Tài khoản đã được kích hoạt.'
                : status ===
                    'SUSPENDED'
                  ? 'Tài khoản đã bị tạm khóa và các phiên đăng nhập đã được thu hồi.'
                  : 'Tài khoản đã bị cấm và các phiên đăng nhập đã được thu hồi.',
            );
          },
        ),

        catchError(
          (
            error: unknown,
          ) => {
            this.actionError.set(
              getApiErrorMessage(
                error,
              ),
            );

            return throwError(
              () => error,
            );
          },
        ),

        finalize(
          () =>
            this.actionLoading.set(
              false,
            ),
        ),
      );
  }

  assignAdminRole(): Observable<AdminUserDetail> {
    const user =
      this.detail();

    if (!user) {
      return throwError(
        () =>
          new Error(
            'Không có người dùng để cập nhật.',
          ),
      );
    }

    this.prepareAction();

    return this.api
      .assignRole(
        user.id,

        'ADMIN',
      )
      .pipe(
        tap(
          (
            updated,
          ) => {
            this.applyUpdatedUser(
              updated,
            );

            this.actionMessage.set(
              'Đã cấp quyền ADMIN cho người dùng.',
            );
          },
        ),

        catchError(
          (
            error: unknown,
          ) => {
            this.actionError.set(
              getApiErrorMessage(
                error,
              ),
            );

            return throwError(
              () => error,
            );
          },
        ),

        finalize(
          () =>
            this.actionLoading.set(
              false,
            ),
        ),
      );
  }

  removeAdminRole(): Observable<AdminUserDetail> {
    const user =
      this.detail();

    if (!user) {
      return throwError(
        () =>
          new Error(
            'Không có người dùng để cập nhật.',
          ),
      );
    }

    this.prepareAction();

    return this.api
      .removeRole(
        user.id,

        'ADMIN',
      )
      .pipe(
        tap(
          (
            updated,
          ) => {
            this.applyUpdatedUser(
              updated,
            );

            this.actionMessage.set(
              'Đã gỡ quyền ADMIN. Các phiên của tài khoản này đã bị thu hồi.',
            );
          },
        ),

        catchError(
          (
            error: unknown,
          ) => {
            this.actionError.set(
              getApiErrorMessage(
                error,
              ),
            );

            return throwError(
              () => error,
            );
          },
        ),

        finalize(
          () =>
            this.actionLoading.set(
              false,
            ),
        ),
      );
  }

  clearActionFeedback(): void {
    this.actionError.set('');

    this.actionMessage.set('');
  }

  private prepareAction(): void {
    this.actionLoading.set(
      true,
    );

    this.actionError.set('');

    this.actionMessage.set('');
  }

  private applyUpdatedUser(
    user:
      AdminUserDetail,
  ): void {
    this.detailState.set(
      user,
    );

    this.usersState.update(
      (
        users,
      ) =>
        users.map(
          (
            current,
          ) =>
            current.id ===
            user.id
              ? {
                  id:
                    user.id,

                  email:
                    user.email,

                  username:
                    user.username,

                  displayName:
                    user.displayName,

                  status:
                    user.status,

                  emailVerified:
                    user.emailVerified,

                  emailVerifiedAt:
                    user.emailVerifiedAt,

                  lastLoginAt:
                    user.lastLoginAt,

                  roles:
                    user.roles,

                  createdAt:
                    user.createdAt,

                  updatedAt:
                    user.updatedAt,
                }
              : current,
        ),
    );
  }

  private reset(): void {
    this.usersState.set(
      [],
    );

    this.totalState.set(0);

    this.detailState.set(
      null,
    );

    this.keyword.set('');

    this.statusFilter.set(
      'ALL',
    );

    this.roleFilter.set(
      'ALL',
    );

    this.page.set(1);

    this.listLoading.set(
      false,
    );

    this.detailLoading.set(
      false,
    );

    this.actionLoading.set(
      false,
    );

    this.listError.set('');

    this.detailError.set('');

    this.actionError.set('');

    this.actionMessage.set('');
  }
}
