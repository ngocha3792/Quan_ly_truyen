import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, takeUntil } from 'rxjs';

import { AuthSessionLifecycleService } from '../../../../core/auth/auth-session-lifecycle.service';
import { getApiErrorMessage } from '../../../../core/http/api-error.util';
import { AdminAuthorApplicationRecord } from '../domain/admin-author-application.models';
import { AdminAuthorApplicationsApiService } from './admin-author-applications-api.service';
import { AdminAuthorApplicationLoadStatus } from './admin-author-applications-list.store';

@Injectable()
export class AdminAuthorApplicationDetailStore {
  private readonly api = inject(AdminAuthorApplicationsApiService);
  private readonly lifecycle = inject(AuthSessionLifecycleService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly detailState = signal<AdminAuthorApplicationRecord | null>(null);
  private requestVersion = 0;

  readonly detail = this.detailState.asReadonly();
  readonly status = signal<AdminAuthorApplicationLoadStatus>('idle');
  readonly error = signal('');

  constructor() {
    this.lifecycle.changes$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.reset());
  }

  load(applicationId: string): void {
    const revision = this.lifecycle.revision();
    const requestVersion = ++this.requestVersion;
    this.status.set('loading');
    this.error.set('');
    this.detailState.set(null);

    this.api
      .getOne(applicationId)
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
        next: (application) => {
          if (!this.isCurrent(revision, requestVersion)) return;
          this.detailState.set(application);
          this.status.set('idle');
        },
        error: (error: unknown) => {
          if (!this.isCurrent(revision, requestVersion)) return;
          this.status.set('error');
          this.error.set(getApiErrorMessage(error));
        },
      });
  }

  replace(application: AdminAuthorApplicationRecord): void {
    this.detailState.set(application);
  }

  private isCurrent(revision: number, requestVersion: number): boolean {
    return revision === this.lifecycle.revision() && requestVersion === this.requestVersion;
  }

  private reset(): void {
    this.requestVersion += 1;
    this.detailState.set(null);
    this.status.set('idle');
    this.error.set('');
  }
}
