import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, Observable, takeUntil, tap, throwError } from 'rxjs';

import { AuthSessionLifecycleService } from '../../../../core/auth/auth-session-lifecycle.service';
import { getApiErrorMessage } from '../../../../core/http/api-error.util';
import { AdminAuthorApplicationRecord } from '../domain/admin-author-application.models';
import { AdminAuthorApplicationsApiService } from './admin-author-applications-api.service';
import { AdminAuthorApplicationDetailStore } from './admin-author-application-detail.store';

export type AdminAuthorApplicationActionStatus = 'idle' | 'approving' | 'rejecting';

@Injectable()
export class AdminAuthorApplicationActionsStore {
  private readonly api = inject(AdminAuthorApplicationsApiService);
  private readonly detailStore = inject(AdminAuthorApplicationDetailStore);
  private readonly lifecycle = inject(AuthSessionLifecycleService);
  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<AdminAuthorApplicationActionStatus>('idle');
  readonly error = signal('');
  readonly message = signal('');
  readonly isReviewing = computed(() => this.status() !== 'idle');

  constructor() {
    this.lifecycle.changes$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.reset());
  }

  approve(): Observable<AdminAuthorApplicationRecord> {
    const application = this.requirePendingApplication();
    if (!application) return this.invalidAction();
    return this.run(
      'approving',
      this.api.approve(application.applicationId),
      'Hồ sơ đã được duyệt và tài khoản tác giả đã được kích hoạt.',
    );
  }

  reject(reason: string): Observable<AdminAuthorApplicationRecord> {
    const application = this.requirePendingApplication();
    if (!application) return this.invalidAction();
    return this.run(
      'rejecting',
      this.api.reject(application.applicationId, reason.trim()),
      'Hồ sơ đã bị từ chối. Người dùng có thể chỉnh sửa và gửi lại.',
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
  ): Observable<AdminAuthorApplicationRecord> {
    if (this.status() !== 'idle') {
      return throwError(() => new Error('Một thao tác xét duyệt khác đang được thực hiện.'));
    }

    const revision = this.lifecycle.revision();
    this.status.set(status);
    this.clearFeedback();

    return request.pipe(
      takeUntil(this.lifecycle.changes$),
      takeUntilDestroyed(this.destroyRef),
      tap((updated) => {
        if (revision !== this.lifecycle.revision()) return;
        this.detailStore.replace(updated);
        this.message.set(message);
      }),
      catchError((error: unknown) => {
        if (revision === this.lifecycle.revision()) this.error.set(getApiErrorMessage(error));
        return throwError(() => error);
      }),
      finalize(() => {
        if (revision === this.lifecycle.revision()) this.status.set('idle');
      }),
    );
  }

  private requirePendingApplication(): AdminAuthorApplicationRecord | null {
    const application = this.detailStore.detail();
    return application?.status === 'PENDING' ? application : null;
  }

  private invalidAction(): Observable<never> {
    return throwError(() => new Error('Hồ sơ không còn ở trạng thái chờ xét duyệt.'));
  }

  private reset(): void {
    this.status.set('idle');
    this.clearFeedback();
  }
}
