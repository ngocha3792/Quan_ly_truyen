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
  AdminAuthorApplicationRecord,
  AdminAuthorApplicationStatusFilter,
} from '../domain/admin-author-application.models';

import {
  AdminAuthorApplicationsApiService,
} from './admin-author-applications-api.service';

export type AdminAuthorApplicationLoadStatus =
  | 'idle'
  | 'loading'
  | 'error';

export type AdminAuthorApplicationActionStatus =
  | 'idle'
  | 'approving'
  | 'rejecting';

@Injectable()
export class AdminAuthorApplicationsStore {
  private readonly api =
    inject(AdminAuthorApplicationsApiService);

  private readonly lifecycle =
    inject(AuthSessionLifecycleService);

  private readonly destroyRef =
    inject(DestroyRef);

  private readonly applicationsState =
    signal<
      readonly AdminAuthorApplicationRecord[]
    >([]);

  private readonly totalState =
    signal(0);

  private readonly detailState =
    signal<AdminAuthorApplicationRecord | null>(
      null,
    );

  private readonly statusFilterState =
    signal<AdminAuthorApplicationStatusFilter>(
      'PENDING',
    );

  private readonly keywordState =
    signal('');

  private readonly pageState =
    signal(1);

  private listRequestVersion = 0;

  private detailRequestVersion = 0;

  readonly pageSize = 20;

  readonly applications =
    this.applicationsState.asReadonly();

  readonly total =
    this.totalState.asReadonly();

  readonly detail =
    this.detailState.asReadonly();

  readonly statusFilter =
    this.statusFilterState.asReadonly();

  readonly keyword =
    this.keywordState.asReadonly();

  readonly page =
    this.pageState.asReadonly();

  readonly listStatus =
    signal<AdminAuthorApplicationLoadStatus>(
      'idle',
    );

  readonly detailStatus =
    signal<AdminAuthorApplicationLoadStatus>(
      'idle',
    );

  readonly actionStatus =
    signal<AdminAuthorApplicationActionStatus>(
      'idle',
    );

  readonly listError =
    signal('');

  readonly detailError =
    signal('');

  readonly actionError =
    signal('');

  readonly actionMessage =
    signal('');

  readonly totalPages =
    computed(() =>
      Math.max(
        1,

        Math.ceil(
          this.totalState() /
            this.pageSize,
        ),
      ),
    );

  readonly isReviewing =
    computed(
      () =>
        this.actionStatus() !==
        'idle',
    );

  constructor() {
    this.lifecycle.changes$
      .pipe(
        takeUntilDestroyed(
          this.destroyRef,
        ),
      )
      .subscribe(() => {
        this.resetSessionState();
      });
  }

  setKeyword(
    value: string,
  ): void {
    this.keywordState.set(
      value,
    );
  }

  search(): void {
    this.pageState.set(1);

    this.loadList();
  }

  setStatusFilter(
    status:
      AdminAuthorApplicationStatusFilter,
  ): void {
    if (
      this.statusFilterState() ===
      status
    ) {
      return;
    }

    this.statusFilterState.set(
      status,
    );

    this.pageState.set(1);

    this.loadList();
  }

  setPage(
    page: number,
  ): void {
    const nextPage = Math.min(
      this.totalPages(),

      Math.max(
        1,

        Math.trunc(page),
      ),
    );

    if (
      nextPage ===
      this.pageState()
    ) {
      return;
    }

    this.pageState.set(
      nextPage,
    );

    this.loadList();
  }

  loadList(): void {
    const revision =
      this.lifecycle.revision();

    const requestVersion =
      ++this.listRequestVersion;

    this.listStatus.set(
      'loading',
    );

    this.listError.set('');

    const filter =
      this.statusFilterState();

    this.api
      .list({
        status:
          filter === 'ALL'
            ? undefined
            : filter,

        keyword:
          this.keywordState()
            .trim() ||
          undefined,

        offset:
          (this.pageState() - 1) *
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

        finalize(() => {
          if (
            revision !==
              this.lifecycle.revision() ||
            requestVersion !==
              this.listRequestVersion
          ) {
            return;
          }

          if (
            this.listStatus() ===
            'loading'
          ) {
            this.listStatus.set(
              'idle',
            );
          }
        }),
      )
      .subscribe({
        next: (response) => {
          if (
            revision !==
              this.lifecycle.revision() ||
            requestVersion !==
              this.listRequestVersion
          ) {
            return;
          }

          this.applicationsState.set(
            response.applications,
          );

          this.totalState.set(
            response.total,
          );

          this.listStatus.set(
            'idle',
          );

          /*
           * Nếu page hiện tại vượt quá
           * total page sau filter/search,
           * quay về page cuối hợp lệ.
           */
          if (
            this.pageState() >
            this.totalPages()
          ) {
            this.pageState.set(
              this.totalPages(),
            );

            this.loadList();
          }
        },

        error: (
          error: unknown,
        ) => {
          if (
            revision !==
              this.lifecycle.revision() ||
            requestVersion !==
              this.listRequestVersion
          ) {
            return;
          }

          this.listStatus.set(
            'error',
          );

          this.listError.set(
            getApiErrorMessage(
              error,
            ),
          );
        },
      });
  }

  loadDetail(
    applicationId: string,
  ): void {
    const revision =
      this.lifecycle.revision();

    const requestVersion =
      ++this.detailRequestVersion;

    this.detailStatus.set(
      'loading',
    );

    this.detailError.set('');

    this.actionError.set('');

    this.actionMessage.set('');

    this.detailState.set(
      null,
    );

    this.api
      .getOne(applicationId)
      .pipe(
        takeUntil(
          this.lifecycle.changes$,
        ),

        takeUntilDestroyed(
          this.destroyRef,
        ),

        finalize(() => {
          if (
            revision !==
              this.lifecycle.revision() ||
            requestVersion !==
              this.detailRequestVersion
          ) {
            return;
          }

          if (
            this.detailStatus() ===
            'loading'
          ) {
            this.detailStatus.set(
              'idle',
            );
          }
        }),
      )
      .subscribe({
        next: (
          application,
        ) => {
          if (
            revision !==
              this.lifecycle.revision() ||
            requestVersion !==
              this.detailRequestVersion
          ) {
            return;
          }

          this.detailState.set(
            application,
          );

          this.detailStatus.set(
            'idle',
          );
        },

        error: (
          error: unknown,
        ) => {
          if (
            revision !==
              this.lifecycle.revision() ||
            requestVersion !==
              this.detailRequestVersion
          ) {
            return;
          }

          this.detailStatus.set(
            'error',
          );

          this.detailError.set(
            getApiErrorMessage(
              error,
            ),
          );
        },
      });
  }

  approve(): Observable<AdminAuthorApplicationRecord> {
    const application =
      this.detailState();

    if (
      !application ||
      application.status !==
        'PENDING'
    ) {
      return throwError(
        () =>
          new Error(
            'Hồ sơ không còn ở trạng thái chờ xét duyệt.',
          ),
      );
    }

    if (
      this.actionStatus() !==
      'idle'
    ) {
      return throwError(
        () =>
          new Error(
            'Một thao tác xét duyệt khác đang được thực hiện.',
          ),
      );
    }

    const revision =
      this.lifecycle.revision();

    this.actionStatus.set(
      'approving',
    );

    this.actionError.set('');

    this.actionMessage.set('');

    return this.api
      .approve(
        application.applicationId,
      )
      .pipe(
        takeUntil(
          this.lifecycle.changes$,
        ),

        takeUntilDestroyed(
          this.destroyRef,
        ),

        tap((updated) => {
          if (
            revision !==
            this.lifecycle.revision()
          ) {
            return;
          }

          this.detailState.set(
            updated,
          );

          this.actionMessage.set(
            'Hồ sơ đã được duyệt và tài khoản tác giả đã được kích hoạt.',
          );
        }),

        catchError(
          (error: unknown) => {
            if (
              revision ===
              this.lifecycle.revision()
            ) {
              this.actionError.set(
                getApiErrorMessage(
                  error,
                ),
              );
            }

            return throwError(
              () => error,
            );
          },
        ),

        finalize(() => {
          if (
            revision ===
            this.lifecycle.revision()
          ) {
            this.actionStatus.set(
              'idle',
            );
          }
        }),
      );
  }

  reject(
    reason: string,
  ): Observable<AdminAuthorApplicationRecord> {
    const application =
      this.detailState();

    if (
      !application ||
      application.status !==
        'PENDING'
    ) {
      return throwError(
        () =>
          new Error(
            'Hồ sơ không còn ở trạng thái chờ xét duyệt.',
          ),
      );
    }

    if (
      this.actionStatus() !==
      'idle'
    ) {
      return throwError(
        () =>
          new Error(
            'Một thao tác xét duyệt khác đang được thực hiện.',
          ),
      );
    }

    const revision =
      this.lifecycle.revision();

    this.actionStatus.set(
      'rejecting',
    );

    this.actionError.set('');

    this.actionMessage.set('');

    return this.api
      .reject(
        application.applicationId,

        reason.trim(),
      )
      .pipe(
        takeUntil(
          this.lifecycle.changes$,
        ),

        takeUntilDestroyed(
          this.destroyRef,
        ),

        tap((updated) => {
          if (
            revision !==
            this.lifecycle.revision()
          ) {
            return;
          }

          this.detailState.set(
            updated,
          );

          this.actionMessage.set(
            'Hồ sơ đã bị từ chối. Người dùng có thể chỉnh sửa và gửi lại.',
          );
        }),

        catchError(
          (error: unknown) => {
            if (
              revision ===
              this.lifecycle.revision()
            ) {
              this.actionError.set(
                getApiErrorMessage(
                  error,
                ),
              );
            }

            return throwError(
              () => error,
            );
          },
        ),

        finalize(() => {
          if (
            revision ===
            this.lifecycle.revision()
          ) {
            this.actionStatus.set(
              'idle',
            );
          }
        }),
      );
  }

  clearActionFeedback(): void {
    this.actionError.set('');

    this.actionMessage.set('');
  }

  private resetSessionState(): void {
    this.listRequestVersion += 1;

    this.detailRequestVersion += 1;

    this.applicationsState.set(
      [],
    );

    this.totalState.set(0);

    this.detailState.set(
      null,
    );

    this.pageState.set(1);

    this.keywordState.set('');

    this.statusFilterState.set(
      'PENDING',
    );

    this.listStatus.set(
      'idle',
    );

    this.detailStatus.set(
      'idle',
    );

    this.actionStatus.set(
      'idle',
    );

    this.listError.set('');

    this.detailError.set('');

    this.actionError.set('');

    this.actionMessage.set('');
  }
}
