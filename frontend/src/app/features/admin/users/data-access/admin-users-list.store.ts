import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, takeUntil } from 'rxjs';

import { AuthSessionLifecycleService } from '../../../../core/auth/auth-session-lifecycle.service';
import { getApiErrorMessage } from '../../../../core/http/api-error.util';
import {
  AdminUserSummary,
  ManagedUserRoleFilter,
  ManagedUserStatusFilter,
} from '../domain/admin-user.models';
import { AdminUsersApiService } from './admin-users-api.service';

@Injectable()
export class AdminUsersListStore {
  private readonly api = inject(AdminUsersApiService);
  private readonly lifecycle = inject(AuthSessionLifecycleService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly usersState = signal<readonly AdminUserSummary[]>([]);
  private readonly totalState = signal(0);

  readonly users = this.usersState.asReadonly();
  readonly total = this.totalState.asReadonly();
  readonly keyword = signal('');
  readonly statusFilter = signal<ManagedUserStatusFilter>('ALL');
  readonly roleFilter = signal<ManagedUserRoleFilter>('ALL');
  readonly page = signal(1);
  readonly pageSize = 20;
  readonly loading = signal(false);
  readonly error = signal('');
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize)));

  constructor() {
    this.lifecycle.changes$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.reset());
  }

  setKeyword(value: string): void {
    this.keyword.set(value);
  }

  search(): void {
    this.page.set(1);
    this.load();
  }

  setStatusFilter(value: ManagedUserStatusFilter): void {
    this.statusFilter.set(value);
    this.page.set(1);
    this.load();
  }

  setRoleFilter(value: ManagedUserRoleFilter): void {
    this.roleFilter.set(value);
    this.page.set(1);
    this.load();
  }

  setPage(value: number): void {
    this.page.set(Math.min(this.totalPages(), Math.max(1, Math.trunc(value))));
    this.load();
  }

  load(): void {
    const revision = this.lifecycle.revision();
    this.loading.set(true);
    this.error.set('');

    this.api
      .list({
        keyword: this.keyword(),
        status: this.statusFilter(),
        role: this.roleFilter(),
        offset: (this.page() - 1) * this.pageSize,
        limit: this.pageSize,
      })
      .pipe(
        takeUntil(this.lifecycle.changes$),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          if (revision === this.lifecycle.revision()) this.loading.set(false);
        }),
      )
      .subscribe({
        next: (response) => {
          if (revision !== this.lifecycle.revision()) return;
          this.usersState.set(response.users);
          this.totalState.set(response.total);
        },
        error: (error: unknown) => {
          if (revision === this.lifecycle.revision()) this.error.set(getApiErrorMessage(error));
        },
      });
  }

  private reset(): void {
    this.usersState.set([]);
    this.totalState.set(0);
    this.keyword.set('');
    this.statusFilter.set('ALL');
    this.roleFilter.set('ALL');
    this.page.set(1);
    this.loading.set(false);
    this.error.set('');
  }
}
