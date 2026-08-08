import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';

import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { finalize, forkJoin, takeUntil } from 'rxjs';

import { AuthAuthorizationSyncService } from '../../../../core/auth/auth-authorization-sync.service';

import { AuthSessionLifecycleService } from '../../../../core/auth/auth-session-lifecycle.service';

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

  private readonly authorizationSync = inject(AuthAuthorizationSyncService);

  private readonly lifecycle = inject(AuthSessionLifecycleService);

  private readonly destroyRef = inject(DestroyRef);

  private readonly configState = signal<AuthorApplicationConfig | null>(null);

  private readonly applicationState = signal<AuthorApplicationRecord | null>(null);

  /**
   * Flag này cũng là session-scoped.
   *
   * Alice APPROVED không được khiến Bob
   * bỏ qua authorization sync sau này.
   */
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

  constructor() {
    /**
     * Bất kỳ auth lifecycle transition nào:
     *
     * Alice -> Bob
     * logout
     * session invalidated
     * access lost
     * remote session established
     *
     * đều làm user-scoped state hiện tại
     * không còn đáng tin cậy.
     */
    this.lifecycle.changes$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.resetSessionState();
    });
  }

  load(): void {
    if (this.status() === 'loading') {
      return;
    }

    /**
     * Snapshot revision tại thời điểm
     * request được tạo.
     */
    const revision = this.lifecycle.revision();

    this.status.set('loading');

    this.message.set('');

    this.errorMessage.set('');

    forkJoin({
      config: this.repository.getConfig(),

      application: this.repository.getMine(),
    })
      .pipe(
        /**
         * Session đổi:
         *
         * hủy cả getConfig + getMine.
         *
         * Với HttpClient, unsubscribe cũng
         * hủy request nếu request còn pending.
         */
        takeUntil(this.lifecycle.changes$),

        takeUntilDestroyed(this.destroyRef),

        finalize(() => {
          /**
           * Finalize của request cũ không được
           * sửa status của session mới.
           */
          if (revision !== this.lifecycle.revision()) {
            return;
          }

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
          /**
           * Belt-and-suspenders:
           *
           * takeUntil đã ngăn stale emission,
           * revision check là lớp bảo vệ thứ hai.
           */
          if (revision !== this.lifecycle.revision()) {
            return;
          }

          this.configState.set(config);

          this.applicationState.set(application);

          this.syncAuthorAuthorization(application);
        },

        error: (error: unknown) => {
          /**
           * Error của Alice không được hiển thị
           * dưới session Bob.
           */
          if (revision !== this.lifecycle.revision()) {
            return;
          }

          this.status.set('error');

          this.errorMessage.set(getApiErrorMessage(error));
        },
      });
  }

  saveDraft(draft: AuthorApplicationDraft): void {
    if (this.status() === 'saving-draft' || this.status() === 'submitting') {
      return;
    }

    const revision = this.lifecycle.revision();

    this.status.set('saving-draft');

    this.message.set('');

    this.errorMessage.set('');

    this.repository
      .saveDraft(draft)
      .pipe(
        /**
         * Đây là phần sửa trực tiếp regression:
         *
         * Alice save đang pending
         * -> Bob login
         * -> subscription Alice bị cancel.
         */
        takeUntil(this.lifecycle.changes$),

        takeUntilDestroyed(this.destroyRef),

        finalize(() => {
          if (revision !== this.lifecycle.revision()) {
            return;
          }

          if (this.status() === 'saving-draft') {
            this.status.set('idle');
          }
        }),
      )
      .subscribe({
        next: (application) => {
          if (revision !== this.lifecycle.revision()) {
            return;
          }

          this.applicationState.set(application);

          this.message.set('Bản nháp đã được lưu.');
        },

        error: (error: unknown) => {
          if (revision !== this.lifecycle.revision()) {
            return;
          }

          this.status.set('error');

          this.errorMessage.set(getApiErrorMessage(error));
        },
      });
  }

  submit(payload: AuthorApplicationPayload): void {
    if (this.status() === 'submitting') {
      return;
    }

    const revision = this.lifecycle.revision();

    this.status.set('submitting');

    this.message.set('');

    this.errorMessage.set('');

    this.repository
      .submit(payload)
      .pipe(
        /**
         * repository.submit() hiện gồm:
         *
         * save draft
         * -> create upload intent
         * -> Cloudinary upload
         * -> confirm media
         * -> submit application
         *
         * Session đổi ở bất kỳ bước nào
         * đều unsubscribe toàn bộ chain.
         */
        takeUntil(this.lifecycle.changes$),

        takeUntilDestroyed(this.destroyRef),

        finalize(() => {
          if (revision !== this.lifecycle.revision()) {
            return;
          }

          /**
           * Bình thường success/error đã đổi status.
           *
           * Fallback này xử lý source complete
           * mà không emit.
           */
          if (this.status() === 'submitting') {
            this.status.set('idle');
          }
        }),
      )
      .subscribe({
        next: (application) => {
          if (revision !== this.lifecycle.revision()) {
            return;
          }

          this.applicationState.set(application);

          this.status.set('success');

          this.message.set(['Yêu cầu đã được gửi.', 'Hồ sơ hiện đang chờ xét duyệt.'].join(' '));
        },

        error: (error: unknown) => {
          if (revision !== this.lifecycle.revision()) {
            return;
          }

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
    if (this.authorAuthorizationSynced || application?.status !== 'APPROVED') {
      return;
    }

    this.authorAuthorizationSynced = true;

    /*
     * AuthorApplication chỉ phát tín hiệu:
     *
     * "authorization có thể đã thay đổi".
     *
     * Nó không biết:
     *
     * - refresh token thế nào
     * - GET /auth/me ra sao
     * - cross-tab synchronization
     *
     * Core Auth chịu trách nhiệm.
     */
    this.authorizationSync.notifyAuthorizationMayHaveChanged();
  }

  private resetSessionState(): void {
    /**
     * Đây chỉ là LOCAL reset.
     *
     * Tuyệt đối không gọi API từ đây.
     */

    this.applicationState.set(null);

    this.status.set('idle');

    this.message.set('');

    this.errorMessage.set('');

    this.authorAuthorizationSynced = false;

    /**
     * configState cố ý KHÔNG reset.
     *
     * /author-applications/config là
     * application policy/catalog chung:
     *
     * genreOptions
     * experienceOptions
     * requirements
     * file limits
     * review steps
     *
     * không chứa dữ liệu user.
     *
     * Nếu sau này config trở thành
     * user-specific thì reset nó ở đây.
     */
  }
}
