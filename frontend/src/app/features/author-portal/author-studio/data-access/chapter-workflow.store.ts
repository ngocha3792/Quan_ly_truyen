import { HttpClient } from '@angular/common/http';
import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, map } from 'rxjs';
import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';
import { ApiSuccessEnvelope } from '../../../../core/http/api-envelope.model';
import { getApiErrorMessage } from '../../../../core/http/api-error.util';
import { AuthorManagedChapter } from '../domain/author-story-management.models';
import {
  ChapterEditorPresence,
  ChapterEditSession,
  ChapterWorkflow,
} from '../domain/chapter-editing.models';
import { ChapterLocalRecoveryService } from './chapter-local-recovery.service';
import { type CreateRetryState, idempotencyHeaders, reuseCreateKey } from './idempotency-http.util';

@Injectable()
export class ChapterWorkflowStore {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_RUNTIME_CONFIG);
  private readonly recovery = inject(ChapterLocalRecoveryService);
  private readonly destroyRef = inject(DestroyRef);
  private url = '';
  private session: ChapterEditSession | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  private transitionRetry: CreateRetryState | null = null;
  readonly workflow = signal<ChapterWorkflow | null>(null);
  readonly editors = signal<readonly ChapterEditorPresence[]>([]);
  readonly warning = signal<string | null>(null);
  readonly busy = signal(false);

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.disposed = true;
      if (this.timer) clearTimeout(this.timer);
      if (this.session)
        this.http
          .delete(`${this.url}/edit-sessions/${this.session.sessionToken}`)
          .subscribe({ error: () => undefined });
    });
  }

  async start(storyId: string, chapterId: string): Promise<void> {
    if (this.url) return;
    this.url = `${this.config.apiBaseUrl}/author/stories/${storyId}/chapters/${chapterId}`;
    await this.refresh();
    await this.heartbeat();
  }

  async refresh(): Promise<void> {
    if (!this.url) return;
    try {
      this.workflow.set(
        await firstValueFrom(
          this.http
            .get<ApiSuccessEnvelope<ChapterWorkflow>>(`${this.url}/workflow`)
            .pipe(map((response) => response.data)),
        ),
      );
    } catch (error) {
      this.warning.set(getApiErrorMessage(error));
    }
  }

  async transition(
    action: 'submit-review' | 'reopen',
    expectedVersion: number,
  ): Promise<AuthorManagedChapter> {
    this.busy.set(true);
    const retry = reuseCreateKey(this.transitionRetry, { action, expectedVersion, url: this.url });
    this.transitionRetry = retry;
    try {
      const chapter = await firstValueFrom(
        this.http
          .post<ApiSuccessEnvelope<AuthorManagedChapter>>(
            `${this.url}/${action}`,
            { expectedVersion },
            { headers: idempotencyHeaders(retry.key) },
          )
          .pipe(map((response) => response.data)),
      );
      if (this.transitionRetry?.key === retry.key) this.transitionRetry = null;
      await this.refresh();
      return chapter;
    } finally {
      this.busy.set(false);
    }
  }

  private async heartbeat(): Promise<void> {
    if (this.disposed) return;
    try {
      await this.refresh();
      const endpoint = `${this.url}/edit-sessions`;
      if (!this.workflow()?.canEdit) {
        if (this.session)
          await firstValueFrom(this.http.delete(`${endpoint}/${this.session.sessionToken}`));
        this.session = null;
        this.editors.set([]);
        return;
      }
      const request = this.session
        ? this.http.put<ApiSuccessEnvelope<ChapterEditSession>>(
            `${endpoint}/${this.session.sessionToken}`,
            { tabId: this.recovery.tabId },
          )
        : this.http.post<ApiSuccessEnvelope<ChapterEditSession>>(endpoint, {
            tabId: this.recovery.tabId,
          });
      this.session = await firstValueFrom(request.pipe(map((response) => response.data)));
      const editors = await firstValueFrom(
        this.http
          .get<ApiSuccessEnvelope<readonly ChapterEditorPresence[]>>(endpoint)
          .pipe(map((response) => response.data)),
      );
      this.editors.set(editors.filter((editor) => editor.id !== this.session?.id));
      this.warning.set(null);
      if (this.disposed)
        this.http
          .delete(`${endpoint}/${this.session.sessionToken}`)
          .subscribe({ error: () => undefined });
    } catch {
      this.session = null;
      this.warning.set(
        'Chưa cập nhật được người đang sửa. Kiểm tra phiên bản vẫn bảo vệ chương khi lưu.',
      );
    } finally {
      if (!this.disposed)
        this.timer = setTimeout(() => {
          void this.heartbeat();
        }, 30000);
    }
  }
}
