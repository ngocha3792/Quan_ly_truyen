import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthorManagedChapter } from '../domain/author-story-management.models';
import { AuthorStoryManagementRepository } from '../domain/author-story-management.repository';
import { ChapterRecoveryEntry } from '../domain/chapter-editing.models';
import { ChapterRecoveryQueueService } from './chapter-recovery-queue.service';
import { ChapterEditingSessionStore } from './chapter-editing-session.store';
import { chapterRecoveryKey, ChapterLocalRecoveryService } from './chapter-local-recovery.service';

const chapter = {
  id: 'chapter',
  storyId: 'story',
  title: 'Tiêu đề',
  content: 'Bản gốc',
  version: 4,
  status: 'DRAFT',
} as AuthorManagedChapter;

describe('ChapterEditingSessionStore', () => {
  let store: ChapterEditingSessionStore;
  const repository = {
    autosaveChapter: vi.fn(),
    updateChapter: vi.fn(),
    createChapter: vi.fn(),
    getChapter: vi.fn(),
    restoreChapterVersion: vi.fn(),
  };
  const recovery = { tabId: 'tab', save: vi.fn(), list: vi.fn(), clearIfRevision: vi.fn() };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();
    recovery.save.mockResolvedValue(undefined);
    recovery.list.mockResolvedValue([]);
    recovery.clearIfRevision.mockResolvedValue(undefined);
    repository.autosaveChapter.mockReturnValue(of({ ...chapter, version: 5 }));
    repository.updateChapter.mockReturnValue(of({ ...chapter, version: 6 }));
    repository.getChapter.mockReturnValue(of({ ...chapter, content: 'Bản máy chủ', version: 8 }));
    TestBed.configureTestingModule({
      providers: [
        ChapterEditingSessionStore,
        ChapterRecoveryQueueService,
        { provide: AuthorStoryManagementRepository, useValue: repository },
        { provide: ChapterLocalRecoveryService, useValue: recovery },
      ],
    });
    store = TestBed.inject(ChapterEditingSessionStore);
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('persists immediately and waits for 2.5 seconds of inactivity before autosaving', async () => {
    await store.initialize('account', 'story', chapter);
    store.change({ title: chapter.title, content: 'Một' });
    await vi.advanceTimersByTimeAsync(2000);
    expect(recovery.save).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 'account',
        chapterId: 'chapter',
        tabId: 'tab',
        content: 'Một',
        baseVersion: 4,
      }),
    );
    expect(repository.autosaveChapter).not.toHaveBeenCalled();
    store.change({ title: chapter.title, content: 'Hai' });
    await vi.advanceTimersByTimeAsync(2499);
    expect(repository.autosaveChapter).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(repository.autosaveChapter).toHaveBeenCalledWith('story', 'chapter', {
      title: chapter.title,
      content: 'Hai',
      expectedVersion: 4,
    });
    expect(store.status()).toBe('saved');
  });

  it('serializes requests and keeps text typed while the previous save is in flight', async () => {
    const first = new Subject<AuthorManagedChapter>();
    repository.autosaveChapter.mockReturnValueOnce(first);
    await store.initialize('account', 'story', chapter);
    store.change({ title: chapter.title, content: 'Một' });
    await vi.advanceTimersByTimeAsync(2500);
    store.change({ title: chapter.title, content: 'Hai mới hơn' });
    await vi.advanceTimersByTimeAsync(3000);
    expect(repository.autosaveChapter).toHaveBeenCalledTimes(1);
    first.next({ ...chapter, content: 'Một', version: 5 });
    first.complete();
    await vi.advanceTimersByTimeAsync(0);
    expect(store.draft().content).toBe('Hai mới hơn');
    expect(store.dirty()).toBe(true);
    expect(recovery.clearIfRevision).toHaveBeenCalledWith(expect.any(String), 1);
    await vi.advanceTimersByTimeAsync(2500);
    expect(repository.autosaveChapter).toHaveBeenLastCalledWith(
      'story',
      'chapter',
      expect.objectContaining({ content: 'Hai mới hơn', expectedVersion: 5 }),
    );
  });

  it('waits for an autosave before manual save and uses its returned version', async () => {
    const first = new Subject<AuthorManagedChapter>();
    repository.autosaveChapter.mockReturnValueOnce(first);
    await store.initialize('account', 'story', chapter);
    store.change({ title: chapter.title, content: 'Một' });
    await vi.advanceTimersByTimeAsync(2500);
    const manual = store.save();
    expect(repository.updateChapter).not.toHaveBeenCalled();
    first.next({ ...chapter, version: 5 });
    first.complete();
    await manual;
    expect(repository.updateChapter).toHaveBeenCalledWith(
      'story',
      'chapter',
      expect.objectContaining({ expectedVersion: 5 }),
    );
  });

  it('uses stable error codes and requires explicit conflict resolution before writing again', async () => {
    repository.autosaveChapter.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: {
              error: { code: 'CHAPTER_VERSION_CONFLICT', message: 'English conflict message' },
            },
          }),
      ),
    );
    await store.initialize('account', 'story', chapter);
    store.change({ title: chapter.title, content: 'Bản của tôi' });
    await vi.advanceTimersByTimeAsync(2500);
    expect(store.status()).toBe('conflict');
    expect(store.draft().content).toBe('Bản của tôi');
    await store.save();
    expect(repository.updateChapter).not.toHaveBeenCalled();
    await store.resolveConflict(false);
    expect(repository.updateChapter).toHaveBeenCalledWith(
      'story',
      'chapter',
      expect.objectContaining({ content: 'Bản của tôi', expectedVersion: 8 }),
    );
  });

  it('asks before recovering a new chapter and never autosaves it as an existing chapter', async () => {
    const entry: ChapterRecoveryEntry = {
      accountId: 'account',
      storyId: 'story',
      chapterId: null,
      tabId: 'old-tab',
      key: 'recovery-key',
      title: 'Bản nháp mới',
      content: 'Chưa gửi máy chủ',
      baseVersion: null,
      revision: 3,
      savedAt: 1,
    };
    recovery.list.mockResolvedValue([entry]);
    await store.initialize('account', 'story', null);
    expect(store.draft().content).toBe('');
    expect(store.recoveries()).toEqual([entry]);
    await store.recover(entry);
    expect(store.draft().content).toBe(entry.content);
    await vi.advanceTimersByTimeAsync(5000);
    expect(repository.autosaveChapter).not.toHaveBeenCalled();
    expect(recovery.save).toHaveBeenCalledWith(
      expect.objectContaining({ chapterId: null, accountId: 'account', tabId: 'tab' }),
    );
  });

  it('treats recovery based on an old version as a conflict', async () => {
    await store.initialize('account', 'story', chapter);
    await store.recover({
      ...chapter,
      accountId: 'account',
      chapterId: chapter.id,
      tabId: 'old',
      key: 'key',
      savedAt: 1,
      revision: 1,
      baseVersion: 2,
    });
    expect(store.status()).toBe('conflict');
    await vi.advanceTimersByTimeAsync(5000);
    expect(repository.autosaveChapter).not.toHaveBeenCalled();
  });

  it('restores using expectedVersion and keeps the current draft on conflict', async () => {
    repository.restoreChapterVersion.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { error: { code: 'CHAPTER_VERSION_CONFLICT' } },
          }),
      ),
    );
    await store.initialize('account', 'story', chapter);
    store.change({ title: chapter.title, content: 'Không được mất' });
    await store.restore(2);
    expect(repository.restoreChapterVersion).toHaveBeenCalledWith('story', 'chapter', 2, 4);
    expect(store.draft().content).toBe('Không được mất');
    expect(store.status()).toBe('conflict');
  });

  it('isolates recovery keys by account, story, chapter and tab', () => {
    const scope = { accountId: 'account', storyId: 'story', chapterId: null, tabId: 'tab' };
    expect(
      new Set([
        chapterRecoveryKey(scope),
        chapterRecoveryKey({ ...scope, accountId: 'other' }),
        chapterRecoveryKey({ ...scope, storyId: 'other' }),
        chapterRecoveryKey({ ...scope, chapterId: 'other' }),
        chapterRecoveryKey({ ...scope, tabId: 'other' }),
      ]).size,
    ).toBe(5);
  });

  it('moves edits made during creation to the created chapter before clearing the new-draft key', async () => {
    const create = new Subject<AuthorManagedChapter>();
    repository.createChapter.mockReturnValue(create);
    await store.initialize('account', 'story', null);
    store.change({ title: chapter.title, content: 'Đã gửi' });
    const pending = store.save();
    store.change({ title: chapter.title, content: 'Gõ thêm trong lúc tạo' });
    create.next({ ...chapter, version: 1 });
    create.complete();
    await pending;
    const oldKey = chapterRecoveryKey({
      accountId: 'account',
      storyId: 'story',
      chapterId: null,
      tabId: 'tab',
    });
    expect(recovery.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        chapterId: chapter.id,
        revision: 2,
        content: 'Gõ thêm trong lúc tạo',
      }),
    );
    expect(recovery.clearIfRevision).toHaveBeenLastCalledWith(oldKey, 2);
    expect(store.dirty()).toBe(true);
  });

  it('does not autosave a chapter that has entered review', async () => {
    await store.initialize('account', 'story', { ...chapter, status: 'IN_REVIEW' });
    store.change({ title: chapter.title, content: 'Stale editor event' });
    await vi.advanceTimersByTimeAsync(5000);
    await store.save();
    expect(repository.autosaveChapter).not.toHaveBeenCalled();
    expect(repository.updateChapter).not.toHaveBeenCalled();
  });

  it('adopts an explicitly approved translation without scheduling another save', async () => {
    await store.initialize('account', 'story', chapter);
    await store.adoptApprovedTranslation(
      { ...chapter, title: 'Reviewed', content: 'Reviewed translation', version: 5 },
      0,
    );
    await vi.advanceTimersByTimeAsync(5000);
    expect(store.draft()).toEqual({ title: 'Reviewed', content: 'Reviewed translation' });
    expect(store.chapter()?.version).toBe(5);
    expect(store.dirty()).toBe(false);
    expect(recovery.clearIfRevision).toHaveBeenCalledWith(expect.any(String), 0);
    expect(repository.autosaveChapter).not.toHaveBeenCalled();
    expect(repository.updateChapter).not.toHaveBeenCalled();
  });

  it('preserves a newer local revision instead of replacing it with a translation response', async () => {
    await store.initialize('account', 'story', chapter);
    store.change({ title: 'Local', content: 'New typing' });
    await store.adoptApprovedTranslation({ ...chapter, content: 'Translated', version: 5 }, 0);
    expect(store.draft().content).toBe('New typing');
    expect(store.dirty()).toBe(true);
    expect(recovery.clearIfRevision).not.toHaveBeenCalled();
  });
});
