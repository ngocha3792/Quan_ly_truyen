import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import {
  AuthorApplicationConfig,
  AuthorApplicationDraft,
  AuthorApplicationPayload,
  AuthorApplicationResult,
  AuthorApplicationStatus,
} from '../domain/author-application.models';
import { AuthorApplicationRepository } from '../domain/author-application.repository';

@Injectable()
export class AuthorApplicationStore {
  private readonly repository = inject(AuthorApplicationRepository);

  private readonly destroyRef = inject(DestroyRef);

  private readonly configState = signal<AuthorApplicationConfig | null>(null);

  private readonly resultState = signal<AuthorApplicationResult | null>(null);

  readonly config = this.configState.asReadonly();

  readonly result = this.resultState.asReadonly();

  readonly status = signal<AuthorApplicationStatus>('idle');

  readonly message = signal('');

  readonly errorMessage = signal('');

  load(): void {
    this.status.set('loading');
    this.errorMessage.set('');

    this.repository
      .getConfig()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (config) => {
          this.configState.set(config);
          this.status.set('idle');
        },

        error: () => {
          this.status.set('error');

          this.errorMessage.set('Không thể tải biểu mẫu đăng ký tác giả.');
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
        next: () => {
          this.message.set('Bản nháp đã được lưu.');
        },

        error: () => {
          this.status.set('error');

          this.errorMessage.set('Không thể lưu bản nháp. Vui lòng thử lại.');
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
    this.resultState.set(null);

    this.repository
      .submit(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.resultState.set(result);
          this.status.set('success');
          this.message.set(result.message);
        },

        error: () => {
          this.status.set('error');

          this.errorMessage.set('Không thể gửi yêu cầu. Vui lòng kiểm tra thông tin và thử lại.');
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
}
