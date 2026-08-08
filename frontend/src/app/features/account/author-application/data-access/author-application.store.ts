import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';

import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { catchError, finalize, forkJoin, of } from 'rxjs';

import { AuthStore } from '../../../../core/auth/auth.store';

import { getApiErrorMessage } from '../../../../core/http/api-error.util';

import {
  AuthorApplicationConfig,
  AuthorApplicationDraft,
  AuthorApplicationPayload,
  AuthorApplicationRecord,
  AuthorApplicationStatus,
} from '../domain/author-application.models';

import { AuthorApplicationRepository } from '../domain/author-application.repository';

@Injectable()
export class AuthorApplicationStore {
  private readonly repository = inject(AuthorApplicationRepository);

  private readonly auth = inject(AuthStore);

  private readonly destroyRef = inject(DestroyRef);

  private readonly configState = signal<AuthorApplicationConfig | null>(null);

  private readonly applicationState = signal<AuthorApplicationRecord | null>(null);

  private authorAuthorizationSynced = false;

  readonly config = this.configState.asReadonly();

  readonly application = this.applicationState.asReadonly();

  readonly status = signal<AuthorApplicationStatus>('idle');

  readonly message = signal('');

  readonly errorMessage = signal('');

  readonly editable = computed(() => {
    const application = this.applicationState();

    return !application || application.status === 'DRAFT' || application.status === 'REJECTED';
  });

  load(): void {
    if (this.status() === 'loading') {
      return;
    }

    this.status.set('loading');

    this.errorMessage.set('');

    forkJoin({
      config: this.repository.getConfig(),

      application: this.repository.getMine(),
    })
      .pipe(
        takeUntilDestroyed(this.destroyRef),

        finalize(() => {
          if (this.status() === 'loading') {
            this.status.set('idle');
          }
        }),
      )
      .subscribe({
        next: ({
          config,

          application,
        }) => {
          this.configState.set(config);

          this.applicationState.set(application);

          this.syncAuthorAuthorization(application);
        },

        error: (error: unknown) => {
          this.status.set('error');

          this.errorMessage.set(getApiErrorMessage(error));
        },
      });
  }

  saveDraft(draft: AuthorApplicationDraft): void {
    if (this.status() === 'saving-draft' || this.status() === 'submitting') {
      return;
    }

    this.status.set('saving-draft');

    this.message.set('');

    this.errorMessage.set('');

    this.repository
      .saveDraft(draft)
      .pipe(
        takeUntilDestroyed(this.destroyRef),

        finalize(() => {
          if (this.status() === 'saving-draft') {
            this.status.set('idle');
          }
        }),
      )
      .subscribe({
        next: (application) => {
          this.applicationState.set(application);

          this.message.set('Bản nháp đã được lưu.');
        },

        error: (error: unknown) => {
          this.status.set('error');

          this.errorMessage.set(getApiErrorMessage(error));
        },
      });
  }

  submit(payload: AuthorApplicationPayload): void {
    if (this.status() === 'submitting') {
      return;
    }

    this.status.set('submitting');

    this.message.set('');

    this.errorMessage.set('');

    this.repository
      .submit(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (application) => {
          this.applicationState.set(application);

          this.status.set('success');

          this.message.set('Yêu cầu đã được gửi. Hồ sơ hiện đang chờ xét duyệt.');
        },

        error: (error: unknown) => {
          this.status.set('error');

          this.errorMessage.set(getApiErrorMessage(error));
        },
      });
  }

  clearMessages(): void {
    this.message.set('');

    this.errorMessage.set('');

    if (this.status() === 'success' || this.status() === 'error') {
      this.status.set('idle');
    }
  }

  private syncAuthorAuthorization(application: AuthorApplicationRecord | null): void {
    if (
      this.authorAuthorizationSynced ||
      application?.status !== 'APPROVED' ||
      this.auth.user()?.roles.includes('AUTHOR')
    ) {
      return;
    }

    this.authorAuthorizationSynced = true;

    /*
     * Approval đã invalidate backend cache.
     *
     * FE vẫn giữ CurrentUser cũ,
     * nên refreshSession để nhận AUTHOR role.
     */
    this.auth
      .refreshSession()
      .pipe(
        takeUntilDestroyed(this.destroyRef),

        catchError(() => of(null)),
      )
      .subscribe();
  }
}
