import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, Observable, takeUntil, tap, throwError } from 'rxjs';

import { AuthSessionLifecycleService } from '../../../../core/auth/auth-session-lifecycle.service';
import { getApiErrorMessage } from '../../../../core/http/api-error.util';
import { AdminUserDetail, ManagedUserStatus } from '../domain/admin-user.models';
import { AdminUserDetailStore } from './admin-user-detail.store';
import { AdminUsersApiService } from './admin-users-api.service';

@Injectable()
export class AdminUserActionsStore {
  private readonly api = inject(AdminUsersApiService);
  private readonly detailStore = inject(AdminUserDetailStore);
  private readonly lifecycle = inject(AuthSessionLifecycleService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(false);
  readonly error = signal('');
  readonly message = signal('');

  constructor() {
    this.lifecycle.changes$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.reset());
  }

  updateStatus(status: ManagedUserStatus): Observable<AdminUserDetail> {
    const user = this.requireUser();
    if (!user) return throwError(() => new Error('Không có người dùng để cập nhật.'));

    return this.run(
      this.api.updateStatus(user.id, status),
      status === 'ACTIVE'
        ? 'Tài khoản đã được kích hoạt.'
        : status === 'SUSPENDED'
          ? 'Tài khoản đã bị tạm khóa và các phiên đăng nhập đã được thu hồi.'
          : 'Tài khoản đã bị cấm và các phiên đăng nhập đã được thu hồi.',
    );
  }

  assignAdminRole(): Observable<AdminUserDetail> {
    const user = this.requireUser();
    if (!user) return throwError(() => new Error('Không có người dùng để cập nhật.'));
    return this.run(this.api.assignRole(user.id, 'ADMIN'), 'Đã cấp quyền ADMIN cho người dùng.');
  }

  removeAdminRole(): Observable<AdminUserDetail> {
    const user = this.requireUser();
    if (!user) return throwError(() => new Error('Không có người dùng để cập nhật.'));
    return this.run(
      this.api.removeRole(user.id, 'ADMIN'),
      'Đã gỡ quyền ADMIN. Các phiên của tài khoản này đã bị thu hồi.',
    );
  }

  clearFeedback(): void {
    this.error.set('');
    this.message.set('');
  }

  private run(request: Observable<AdminUserDetail>, message: string): Observable<AdminUserDetail> {
    const revision = this.lifecycle.revision();
    this.loading.set(true);
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
        if (revision === this.lifecycle.revision()) this.loading.set(false);
      }),
    );
  }

  private requireUser(): AdminUserDetail | null {
    return this.detailStore.detail();
  }

  private reset(): void {
    this.loading.set(false);
    this.clearFeedback();
  }
}
