import { DestroyRef, inject, Injectable } from '@angular/core';

import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { finalize, forkJoin, MonoTypeOperatorFunction, takeUntil } from 'rxjs';

import { AuthSessionLifecycleService } from '../../../../core/auth/auth-session-lifecycle.service';

import { getApiErrorMessage } from '../../../../core/http/api-error.util';

import {
  AuthorApplicationDraft,
  AuthorApplicationPayload,
} from '../domain/author-application.models';

import { AuthorApplicationRepository } from '../domain/author-application.repository';

import { AuthorApplicationState } from './author-application.state';

@Injectable()
export class AuthorApplicationStore {
  private readonly repository = inject(AuthorApplicationRepository);

  private readonly state = inject(AuthorApplicationState);

  private readonly lifecycle = inject(AuthSessionLifecycleService);

  private readonly destroyRef = inject(DestroyRef);

  readonly config = this.state.config;

  readonly application = this.state.application;

  readonly status = this.state.status;

  readonly message = this.state.message;

  readonly errorMessage = this.state.errorMessage;

  readonly checkingStatus = this.state.checkingStatus;

  readonly editable = this.state.editable;

  load(): void {
    if (this.status() === 'loading') {
      return;
    }

    const revision = this.lifecycle.revision();

    this.state.begin('loading');

    forkJoin({
      config: this.repository.getConfig(),

      application: this.repository.getMine(),
    })
      .pipe(
        this.untilSessionChanges(),

        finalize(() => {
          if (this.isCurrentRevision(revision)) {
            this.state.finishIf('loading');
          }
        }),
      )
      .subscribe({
        next: ({ config, application }) => {
          if (!this.isCurrentRevision(revision)) {
            return;
          }

          this.state.setLoaded(config, application);
        },

        error: (error: unknown) => {
          if (this.isCurrentRevision(revision)) {
            this.state.setError(getApiErrorMessage(error));
          }
        },
      });
  }

  refreshApplicationStatus(): void {
    const current = this.application();

    if (!current || current.status !== 'PENDING' || this.checkingStatus()) {
      return;
    }

    const revision = this.lifecycle.revision();

    this.state.setCheckingStatus(true);

    this.repository
      .getMine()
      .pipe(
        this.untilSessionChanges(),

        finalize(() => {
          if (this.isCurrentRevision(revision)) {
            this.state.setCheckingStatus(false);
          }
        }),
      )
      .subscribe({
        next: (application) => {
          if (this.isCurrentRevision(revision)) {
            this.state.setApplication(application);
          }
        },

        error: (error: unknown) => {
          if (this.isCurrentRevision(revision)) {
            /*
             * refresh status lỗi không biến toàn page
             * thành error state.
             *
             * Giữ semantics cũ.
             */
            this.state.setPassiveError(getApiErrorMessage(error));
          }
        },
      });
  }

  saveDraft(draft: AuthorApplicationDraft): void {
    if (this.status() === 'saving-draft' || this.status() === 'submitting') {
      return;
    }

    const revision = this.lifecycle.revision();

    this.state.begin('saving-draft');

    this.repository
      .saveDraft(draft)
      .pipe(
        this.untilSessionChanges(),

        finalize(() => {
          if (this.isCurrentRevision(revision)) {
            this.state.finishIf('saving-draft');
          }
        }),
      )
      .subscribe({
        next: (application) => {
          if (!this.isCurrentRevision(revision)) {
            return;
          }

          this.state.setApplication(application);

          this.state.setMessage('Bản nháp đã được lưu.');
        },

        error: (error: unknown) => {
          if (this.isCurrentRevision(revision)) {
            this.state.setError(getApiErrorMessage(error));
          }
        },
      });
  }

  submit(payload: AuthorApplicationPayload): void {
    if (this.status() === 'submitting') {
      return;
    }

    const revision = this.lifecycle.revision();

    this.state.begin('submitting');

    this.repository
      .submit(payload)
      .pipe(
        this.untilSessionChanges(),

        finalize(() => {
          if (this.isCurrentRevision(revision)) {
            this.state.finishIf('submitting');
          }
        }),
      )
      .subscribe({
        next: (application) => {
          if (!this.isCurrentRevision(revision)) {
            return;
          }

          this.state.setApplication(application);

          this.state.setSuccess('Yêu cầu đã được gửi. Hồ sơ hiện đang chờ xét duyệt.');
        },

        error: (error: unknown) => {
          if (this.isCurrentRevision(revision)) {
            this.state.setError(getApiErrorMessage(error));
          }
        },
      });
  }

  clearMessages(): void {
    this.state.clearMessages();
  }

  private untilSessionChanges<T>(): MonoTypeOperatorFunction<T> {
    return (source) =>
      source.pipe(
        takeUntil(this.lifecycle.changes$),

        takeUntilDestroyed(this.destroyRef),
      );
  }

  private isCurrentRevision(revision: number): boolean {
    return revision === this.lifecycle.revision();
  }
}
