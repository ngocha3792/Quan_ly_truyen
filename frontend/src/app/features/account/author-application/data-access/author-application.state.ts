import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';

import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AuthAuthorizationSyncService } from '../../../../core/auth/auth-authorization-sync.service';

import { AuthSessionLifecycleService } from '../../../../core/auth/auth-session-lifecycle.service';

import {
  AuthorApplicationConfig,
  AuthorApplicationRecord,
  AuthorApplicationStatus,
} from '../domain/author-application.models';

@Injectable()
export class AuthorApplicationState {
  private readonly authorizationSync = inject(AuthAuthorizationSyncService);

  private readonly lifecycle = inject(AuthSessionLifecycleService);

  private readonly destroyRef = inject(DestroyRef);

  private readonly configState = signal<AuthorApplicationConfig | null>(null);

  private readonly applicationState = signal<AuthorApplicationRecord | null>(null);

  private authorAuthorizationSynced = false;

  readonly config = this.configState.asReadonly();

  readonly application = this.applicationState.asReadonly();

  readonly status = signal<AuthorApplicationStatus>('idle');

  readonly message = signal('');

  readonly errorMessage = signal('');

  readonly checkingStatus = signal(false);

  readonly editable = computed(() => {
    const application = this.applicationState();

    return !application || application.status === 'DRAFT' || application.status === 'REJECTED';
  });

  constructor() {
    this.lifecycle.changes$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.resetForSessionChange();
    });
  }

  begin(status: 'loading' | 'saving-draft' | 'submitting'): void {
    this.status.set(status);

    this.clearFeedback();
  }

  setLoaded(config: AuthorApplicationConfig, application: AuthorApplicationRecord | null): void {
    this.configState.set(config);

    this.setApplication(application);
  }

  setApplication(application: AuthorApplicationRecord | null): void {
    this.applicationState.set(application);

    this.syncAuthorAuthorization(application);
  }

  setCheckingStatus(checking: boolean): void {
    this.checkingStatus.set(checking);
  }

  setSuccess(message: string): void {
    this.status.set('success');

    this.errorMessage.set('');

    this.message.set(message);
  }

  setMessage(message: string): void {
    this.message.set(message);
  }

  setError(message: string): void {
    this.status.set('error');

    this.message.set('');

    this.errorMessage.set(message);
  }

  setPassiveError(message: string): void {
    this.errorMessage.set(message);
  }

  finishIf(status: AuthorApplicationStatus): void {
    if (this.status() === status) {
      this.status.set('idle');
    }
  }

  clearMessages(): void {
    this.clearFeedback();

    if (this.status() === 'success' || this.status() === 'error') {
      this.status.set('idle');
    }
  }

  private clearFeedback(): void {
    this.message.set('');

    this.errorMessage.set('');
  }

  private syncAuthorAuthorization(application: AuthorApplicationRecord | null): void {
    if (this.authorAuthorizationSynced || application?.status !== 'APPROVED') {
      return;
    }

    this.authorAuthorizationSynced = true;

    this.authorizationSync.notifyAuthorizationMayHaveChanged();
  }

  private resetForSessionChange(): void {
    this.applicationState.set(null);

    this.status.set('idle');

    this.clearFeedback();

    this.checkingStatus.set(false);

    this.authorAuthorizationSynced = false;

    /*
     * configState cố ý giữ lại.
     *
     * Config chỉ chứa application policy/catalog chung,
     * không chứa dữ liệu riêng của user.
     */
  }
}
