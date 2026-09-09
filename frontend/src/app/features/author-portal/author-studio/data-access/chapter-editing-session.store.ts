import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { getApiErrorCode, getApiErrorMessage } from '../../../../core/http/api-error.util';
import { AuthorManagedChapter } from '../domain/author-story-management.models';
import { AuthorStoryManagementRepository } from '../domain/author-story-management.repository';
import {
  ChapterDraft,
  ChapterRecoveryEntry,
  ChapterRecoveryScope,
} from '../domain/chapter-editing.models';
import { chapterRecoveryKey, ChapterLocalRecoveryService } from './chapter-local-recovery.service';
import { ChapterRecoveryQueueService } from './chapter-recovery-queue.service';

@Injectable()
export class ChapterEditingSessionStore {
  private readonly repository = inject(AuthorStoryManagementRepository);
  private readonly recovery = inject(ChapterLocalRecoveryService);
  private readonly localQueue = inject(ChapterRecoveryQueueService);
  private readonly destroyRef = inject(DestroyRef);
  private scope: ChapterRecoveryScope | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private activeSave: Promise<AuthorManagedChapter | null> | null = null;
  private disposed = false;
  private ready = false;
  readonly chapter = signal<AuthorManagedChapter | null>(null);
  readonly draft = signal<ChapterDraft>({ title: '', content: '' });
  readonly revision = signal(0);
  private readonly savedRevision = signal(0);
  readonly dirty = computed(() => this.revision() !== this.savedRevision());
  readonly status = signal<'idle' | 'saving' | 'saved' | 'conflict' | 'error'>('idle');
  readonly busy = signal(false);
  readonly restoring = signal(false);
  readonly error = signal<string | null>(null);
  readonly recoveryError = this.localQueue.error;
  readonly recoveries = signal<readonly ChapterRecoveryEntry[]>([]);
  readonly conflictServer = signal<AuthorManagedChapter | null>(null);
  readonly lastSaved = signal<Date | null>(null);

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.disposed = true;
      this.cancelTimer();
    });
  }

  async initialize(
    accountId: string,
    storyId: string,
    chapter: AuthorManagedChapter | null,
  ): Promise<void> {
    if (this.ready) return;
    this.ready = true;
    this.scope = { accountId, storyId, chapterId: chapter?.id ?? null, tabId: this.recovery.tabId };
    this.chapter.set(chapter);
    this.draft.set({ title: chapter?.title ?? '', content: chapter?.content ?? '' });
    try {
      this.recoveries.set(
        (await this.recovery.list(this.scope)).filter(
          (entry) => entry.title !== this.draft().title || entry.content !== this.draft().content,
        ),
      );
    } catch {
      this.recoveryError.set('Không thể đọc bản nháp cục bộ. Nội dung vẫn có thể lưu lên máy chủ.');
    }
  }

  change(draft: ChapterDraft): void {
    if (!this.scope || this.disposed) return;
    this.draft.set(draft);
    this.revision.update((revision) => revision + 1);
    if (this.status() !== 'conflict') this.status.set('idle');
    this.persistLocal();
    this.schedule();
  }

  private persistLocal(): void {
    if (!this.scope) return;
    this.localQueue.save(
      this.scope,
      this.draft(),
      this.revision(),
      this.chapter()?.version ?? null,
    );
  }

  private schedule(): void {
    this.cancelTimer();
    if (
      this.chapter()?.status !== 'DRAFT' ||
      this.status() === 'conflict' ||
      this.recoveries().length
    )
      return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.save(false);
    }, 2500);
  }

  async save(manual = true): Promise<AuthorManagedChapter | null> {
    this.cancelTimer();
    if (this.activeSave) {
      if (!manual) return null;
      await this.activeSave;
      return this.save(true);
    }
    if (
      !this.scope ||
      this.busy() ||
      this.disposed ||
      this.status() === 'conflict' ||
      this.recoveries().length ||
      (this.chapter() !== null && this.chapter()?.status !== 'DRAFT') ||
      !this.draft().title.trim()
    )
      return null;
    if (!manual && !this.dirty()) return this.chapter();
    const scope = this.scope;
    const revision = this.revision();
    const snapshot = this.draft();
    const current = this.chapter();
    const input = {
      title: snapshot.title.trim(),
      content: snapshot.content,
      ...(current ? { expectedVersion: current.version } : {}),
    };
    this.busy.set(true);
    this.status.set('saving');
    this.error.set(null);
    const request = current
      ? manual
        ? this.repository.updateChapter(scope.storyId, current.id, input)
        : this.repository.autosaveChapter(scope.storyId, current.id, input)
      : this.repository.createChapter(scope.storyId, input);
    this.activeSave = firstValueFrom(request)
      .then(async (chapter) => {
        this.chapter.set(chapter);
        this.scope = { ...scope, chapterId: chapter.id };
        this.savedRevision.set(revision);
        this.lastSaved.set(new Date());
        this.status.set(this.dirty() ? 'idle' : 'saved');
        await this.localQueue.flush();
        await this.recovery
          .clearIfRevision(chapterRecoveryKey(scope), revision)
          .catch(() => undefined);
        if (this.dirty()) {
          const migratedRevision = this.revision();
          this.persistLocal();
          await this.localQueue.flush();
          if (scope.chapterId === null && !this.recoveryError())
            await this.recovery
              .clearIfRevision(chapterRecoveryKey(scope), migratedRevision)
              .catch(() => undefined);
        }
        return chapter;
      })
      .catch(async (error: unknown) => {
        await this.handleError(error);
        return null;
      })
      .finally(() => {
        this.busy.set(false);
        this.activeSave = null;
        if (this.dirty() && this.status() === 'idle' && !this.disposed) this.schedule();
      });
    return this.activeSave;
  }

  async restore(version: number): Promise<AuthorManagedChapter | null> {
    this.cancelTimer();
    if (this.activeSave) await this.activeSave;
    this.cancelTimer();
    const chapter = this.chapter();
    if (!this.scope || !chapter || this.status() === 'conflict' || this.busy()) return null;
    this.busy.set(true);
    this.restoring.set(true);
    this.status.set('saving');
    const revision = this.revision();
    try {
      const restored = await firstValueFrom(
        this.repository.restoreChapterVersion(
          this.scope.storyId,
          chapter.id,
          version,
          chapter.version,
        ),
      );
      this.chapter.set(restored);
      if (this.revision() === revision) {
        this.draft.set({ title: restored.title, content: restored.content });
        this.savedRevision.set(revision);
        await this.localQueue.flush();
        await this.recovery.clearIfRevision(chapterRecoveryKey(this.scope), revision);
      }
      this.status.set(this.dirty() ? 'idle' : 'saved');
      return restored;
    } catch (error) {
      await this.handleError(error);
      return null;
    } finally {
      this.busy.set(false);
      this.restoring.set(false);
    }
  }

  async recover(entry: ChapterRecoveryEntry): Promise<void> {
    this.recoveries.set([]);
    if (entry.baseVersion !== (this.chapter()?.version ?? null)) {
      this.conflictServer.set(this.chapter());
      this.status.set('conflict');
    }
    this.change({ title: entry.title, content: entry.content });
    await this.localQueue.flush();
    if (!this.recoveryError())
      await this.recovery.clearIfRevision(entry.key, entry.revision).catch(() => undefined);
  }

  async discardRecoveries(): Promise<void> {
    const entries = this.recoveries();
    await Promise.all(
      entries.map((entry) => this.recovery.clearIfRevision(entry.key, entry.revision)),
    ).catch(() =>
      this.recoveryError.set(
        'Không thể xóa bản nháp cục bộ. Bạn có thể tiếp tục viết; bản cũ vẫn được giữ.',
      ),
    );
    this.recoveries.set([]);
    if (this.dirty()) this.schedule();
  }

  async resolveConflict(useServer: boolean): Promise<void> {
    const server = this.conflictServer();
    if (!server) return;
    this.chapter.set(server);
    this.conflictServer.set(null);
    this.status.set('idle');
    this.error.set(null);
    if (useServer) {
      const revision = this.revision();
      this.draft.set({ title: server.title, content: server.content });
      this.savedRevision.set(this.revision());
      if (this.scope) {
        await this.localQueue.flush();
        await this.recovery.clearIfRevision(chapterRecoveryKey(this.scope), revision);
      }
    } else {
      this.persistLocal();
      await this.save(true);
    }
  }

  async handleError(error: unknown): Promise<void> {
    this.error.set(getApiErrorMessage(error));
    const conflict = getApiErrorCode(error) === 'CHAPTER_VERSION_CONFLICT';
    this.status.set(conflict ? 'conflict' : 'error');
    if (conflict) await this.refreshConflict();
  }

  async refreshConflict(): Promise<void> {
    if (!this.scope?.chapterId) return;
    try {
      this.conflictServer.set(
        await firstValueFrom(this.repository.getChapter(this.scope.storyId, this.scope.chapterId)),
      );
    } catch {
      this.error.set(
        'Không tải được bản trên máy chủ. Bản đang viết vẫn được giữ; hãy thử tải lại để so sánh.',
      );
    }
  }

  adoptChapter(chapter: AuthorManagedChapter): void {
    this.chapter.set(chapter);
  }
  async synchronizeServer(): Promise<void> {
    if (!this.scope?.chapterId || this.busy()) return;
    const server = await firstValueFrom(
      this.repository.getChapter(this.scope.storyId, this.scope.chapterId),
    ).catch(() => null);
    if (!server || this.busy() || server.version <= (this.chapter()?.version ?? 0)) return;
    if (this.dirty()) {
      this.conflictServer.set(server);
      this.status.set('conflict');
      this.cancelTimer();
    } else {
      this.chapter.set(server);
      this.draft.set({ title: server.title, content: server.content });
    }
  }
  canLeave(): Promise<boolean> {
    return this.localQueue.confirmLeave(this.dirty(), this.busy());
  }
  private cancelTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
