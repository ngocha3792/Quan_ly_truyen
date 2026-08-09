import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, takeUntil } from 'rxjs';

import { AuthSessionLifecycleService } from '../../../../core/auth/auth-session-lifecycle.service';
import { getApiErrorMessage } from '../../../../core/http/api-error.util';
import {
  AdminAuthorApplicationRecord,
  AdminAuthorApplicationStatusFilter,
} from '../domain/admin-author-application.models';
import { AdminAuthorApplicationsApiService } from './admin-author-applications-api.service';

export type AdminAuthorApplicationLoadStatus = 'idle' | 'loading' | 'error';

@Injectable()
export class AdminAuthorApplicationsListStore {
  private readonly api = inject(AdminAuthorApplicationsApiService);
  private readonly lifecycle = inject(AuthSessionLifecycleService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly applicationsState = signal<readonly AdminAuthorApplicationRecord[]>([]);
  private readonly totalState = signal(0);
  private readonly statusFilterState = signal<AdminAuthorApplicationStatusFilter>('PENDING');
  private readonly keywordState = signal('');
  private readonly pageState = signal(1);
  private requestVersion = 0;

  readonly pageSize = 20;
  readonly applications = this.applicationsState.asReadonly();
  readonly total = this.totalState.asReadonly();
  readonly statusFilter = this.statusFilterState.asReadonly();
  readonly keyword = this.keywordState.asReadonly();
  readonly page = this.pageState.asReadonly();
  readonly status = signal<AdminAuthorApplicationLoadStatus>('idle');
  readonly error = signal('');
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize)));

  constructor() {
    this.lifecycle.changes$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.reset());
  }

  setKeyword(value: string): void {
    this.keywordState.set(value);
  }

  search(): void {
    this.pageState.set(1);
    this.load();
  }

  setStatusFilter(status: AdminAuthorApplicationStatusFilter): void {
    if (this.statusFilterState() === status) return;
    this.statusFilterState.set(status);
    this.pageState.set(1);
    this.load();
  }

  setPage(page: number): void {
    const nextPage = Math.min(this.totalPages(), Math.max(1, Math.trunc(page)));
    if (nextPage === this.pageState()) return;
    this.pageState.set(nextPage);
    this.load();
  }

  load(): void {
    const revision = this.lifecycle.revision();
    const requestVersion = ++this.requestVersion;
    this.status.set('loading');
    this.error.set('');
    const filter = this.statusFilterState();

    this.api
      .list({
        status: filter === 'ALL' ? undefined : filter,
        keyword: this.keywordState().trim() || undefined,
        offset: (this.pageState() - 1) * this.pageSize,
        limit: this.pageSize,
      })
      .pipe(
        takeUntil(this.lifecycle.changes$),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          if (this.isCurrent(revision, requestVersion) && this.status() === 'loading') {
            this.status.set('idle');
          }
        }),
      )
      .subscribe({
        next: (response) => {
          if (!this.isCurrent(revision, requestVersion)) return;
          this.applicationsState.set(response.applications);
          this.totalState.set(response.total);
          this.status.set('idle');
          if (this.pageState() > this.totalPages()) {
            this.pageState.set(this.totalPages());
            this.load();
          }
        },
        error: (error: unknown) => {
          if (!this.isCurrent(revision, requestVersion)) return;
          this.status.set('error');
          this.error.set(getApiErrorMessage(error));
        },
      });
  }

  private isCurrent(revision: number, requestVersion: number): boolean {
    return revision === this.lifecycle.revision() && requestVersion === this.requestVersion;
  }

  private reset(): void {
    this.requestVersion += 1;
    this.applicationsState.set([]);
    this.totalState.set(0);
    this.pageState.set(1);
    this.keywordState.set('');
    this.statusFilterState.set('PENDING');
    this.status.set('idle');
    this.error.set('');
  }
}
