import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, Observable, takeUntil, tap, throwError } from 'rxjs';

import { AuthSessionLifecycleService } from '../../../../core/auth/auth-session-lifecycle.service';
import { getApiErrorMessage } from '../../../../core/http/api-error.util';
import { AdminAuthorApplicationRecord } from '../domain/admin-author-application.models';
import { AdminAuthorApplicationsApiService } from './admin-author-applications-api.service';
import { AdminAuthorApplicationDetailStore } from './admin-author-application-detail.store';

export type AdminAuthorApplicationActionStatus = 'idle' | 'approving' | 'rejecting';

type AdminAuthorApplicationReviewAction = 'approve' | 'reject';

interface AdminAuthorApplicationRetryOperation {
  readonly applicationId: string;

  readonly action: AdminAuthorApplicationReviewAction;

  readonly rejectionReason: string | null;

  readonly idempotencyKey: string;
}

@Injectable()
export class AdminAuthorApplicationActionsStore {
  private readonly api = inject(AdminAuthorApplicationsApiService);

  private readonly detailStore = inject(AdminAuthorApplicationDetailStore);

  private readonly lifecycle = inject(AuthSessionLifecycleService);

  private readonly destroyRef = inject(DestroyRef);

  /*
   * Chỉ lưu operation chưa nhận được authoritative success.
   *
   * Ví dụ:
   *
   * approve application-1
   * key = abc
   * backend commit
   * response bị mất
   *
   * => retry vẫn phải dùng abc.
   */
  private retryOperation: AdminAuthorApplicationRetryOperation | null = null;

  readonly status = signal<AdminAuthorApplicationActionStatus>('idle');

  readonly error = signal('');

  readonly message = signal('');

  readonly isReviewing = computed(() => this.status() !== 'idle');

  constructor() {
    /*
     * Operation retry thuộc về đúng auth session hiện tại.
     *
     * Logout / đổi reviewer / session invalidation:
     * không được mang idempotency key sang session mới.
     */
    this.lifecycle.changes$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.reset());
  }

  approve(): Observable<AdminAuthorApplicationRecord> {
    /*
     * Check trước khi resolve operation.
     *
     * Nếu approve đang chạy mà UI vô tình phát reject,
     * request thứ hai không được thay retryOperation
     * của approve đang pending.
     */
    if (this.status() !== 'idle') {
      return this.busyAction();
    }

    const application = this.requirePendingApplication();

    if (!application) {
      return this.invalidAction();
    }

    const operation = this.resolveRetryOperation(
      application.applicationId,

      'approve',

      null,
    );

    return this.run(
      'approving',

      this.api.approve(
        application.applicationId,

        operation.idempotencyKey,
      ),

      'Hồ sơ đã được duyệt và tài khoản tác giả đã được kích hoạt.',

      operation,
    );
  }

  reject(reason: string): Observable<AdminAuthorApplicationRecord> {
    if (this.status() !== 'idle') {
      return this.busyAction();
    }

    const application = this.requirePendingApplication();

    if (!application) {
      return this.invalidAction();
    }

    /*
     * Normalize trước khi tạo operation identity.
     *
     * "  lý do abc  "
     * và
     * "lý do abc"
     *
     * là cùng business operation.
     */
    const normalizedReason = reason.trim();

    const operation = this.resolveRetryOperation(
      application.applicationId,

      'reject',

      normalizedReason,
    );

    return this.run(
      'rejecting',

      this.api.reject(
        application.applicationId,

        normalizedReason,

        operation.idempotencyKey,
      ),

      'Hồ sơ đã bị từ chối. Người dùng có thể chỉnh sửa và gửi lại.',

      operation,
    );
  }

  clearFeedback(): void {
    this.error.set('');

    this.message.set('');
  }

  private run(
    status: Exclude<AdminAuthorApplicationActionStatus, 'idle'>,

    request: Observable<AdminAuthorApplicationRecord>,

    message: string,

    operation: AdminAuthorApplicationRetryOperation,
  ): Observable<AdminAuthorApplicationRecord> {
    /*
     * Defense-in-depth.
     *
     * approve()/reject() đã check ở ngoài,
     * nhưng run() vẫn tự bảo vệ invariants.
     */
    if (this.status() !== 'idle') {
      return this.busyAction();
    }

    const revision = this.lifecycle.revision();

    this.status.set(status);

    this.clearFeedback();

    return request.pipe(
      takeUntil(this.lifecycle.changes$),

      takeUntilDestroyed(this.destroyRef),

      tap((updated) => {
        if (revision !== this.lifecycle.revision()) {
          return;
        }

        this.detailStore.replace(updated);

        /*
         * Chỉ authoritative success mới chứng minh
         * operation đã hoàn thành.
         *
         * Từ đây retry key cũ không còn được dùng nữa.
         */
        this.clearRetryOperation(operation);

        this.message.set(message);
      }),

      catchError((error: unknown) => {
        if (revision === this.lifecycle.revision()) {
          this.error.set(getApiErrorMessage(error));
        }

        /*
         * QUAN TRỌNG:
         *
         * Không clear retryOperation khi request lỗi.
         *
         * Client nhìn thấy:
         *
         * - network error;
         * - timeout;
         * - 502/503/504;
         * - response bị mất;
         * - idempotency request vẫn PROCESSING;
         *
         * không thể chứng minh backend chưa commit.
         *
         * Vì vậy retry cùng business operation
         * phải reuse đúng idempotency key.
         */
        return throwError(() => error);
      }),

      finalize(() => {
        if (revision === this.lifecycle.revision()) {
          this.status.set('idle');
        }
      }),
    );
  }

  private resolveRetryOperation(
    applicationId: string,

    action: AdminAuthorApplicationReviewAction,

    rejectionReason: string | null,
  ): AdminAuthorApplicationRetryOperation {
    const current = this.retryOperation;

    /*
     * Cùng:
     *
     * application
     * + action
     * + normalized reject reason
     *
     * => cùng một business operation
     * => reuse key.
     */
    if (
      current &&
      current.applicationId === applicationId &&
      current.action === action &&
      current.rejectionReason === rejectionReason
    ) {
      return current;
    }

    /*
     * Một trong các thứ sau thay đổi:
     *
     * - application;
     * - approve <-> reject;
     * - rejection reason;
     *
     * => operation mới
     * => idempotency key mới.
     */
    const next: AdminAuthorApplicationRetryOperation = {
      applicationId,

      action,

      rejectionReason,

      idempotencyKey: crypto.randomUUID(),
    };

    this.retryOperation = next;

    return next;
  }

  private clearRetryOperation(operation: AdminAuthorApplicationRetryOperation): void {
    /*
     * Dùng object identity để tránh một response cũ
     * clear nhầm operation mới hơn.
     */
    if (this.retryOperation === operation) {
      this.retryOperation = null;
    }
  }

  private requirePendingApplication(): AdminAuthorApplicationRecord | null {
    const application = this.detailStore.detail();

    return application?.status === 'PENDING' ? application : null;
  }

  private busyAction(): Observable<never> {
    return throwError(() => new Error('Một thao tác xét duyệt khác đang được thực hiện.'));
  }

  private invalidAction(): Observable<never> {
    /*
     * Nếu authoritative local state đã cho biết
     * application không còn PENDING thì operation cũ
     * không còn retryable từ màn hình hiện tại.
     */
    this.retryOperation = null;

    return throwError(() => new Error('Hồ sơ không còn ở trạng thái chờ xét duyệt.'));
  }

  private reset(): void {
    this.retryOperation = null;

    this.status.set('idle');

    this.clearFeedback();
  }
}
