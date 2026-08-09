import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, takeUntil } from 'rxjs';

import { AuthSessionLifecycleService } from '../../../../core/auth/auth-session-lifecycle.service';
import { getApiErrorMessage } from '../../../../core/http/api-error.util';
import { AdminUserDetail } from '../domain/admin-user.models';
import { AdminUsersApiService } from './admin-users-api.service';

@Injectable()
export class AdminUserDetailStore {
  private readonly api = inject(AdminUsersApiService);
  private readonly lifecycle = inject(AuthSessionLifecycleService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly detailState = signal<AdminUserDetail | null>(null);

  readonly detail = this.detailState.asReadonly();
  readonly loading = signal(false);
  readonly error = signal('');

  constructor() {
    this.lifecycle.changes$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.reset());
  }

  load(userId: string): void {
    const revision = this.lifecycle.revision();
    this.loading.set(true);
    this.error.set('');
    this.detailState.set(null);

    this.api
      .getOne(userId)
      .pipe(
        takeUntil(this.lifecycle.changes$),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          if (revision === this.lifecycle.revision()) this.loading.set(false);
        }),
      )
      .subscribe({
        next: (user) => {
          if (revision === this.lifecycle.revision()) this.detailState.set(user);
        },
        error: (error: unknown) => {
          if (revision === this.lifecycle.revision()) this.error.set(getApiErrorMessage(error));
        },
      });
  }

  replace(user: AdminUserDetail): void {
    this.detailState.set(user);
  }

  private reset(): void {
    this.detailState.set(null);
    this.loading.set(false);
    this.error.set('');
  }
}
