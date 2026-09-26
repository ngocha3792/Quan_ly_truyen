import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthorManagedChapterSummary } from '../domain/author-story-management.models';
import { AuthorStoryManagementRepository } from '../domain/author-story-management.repository';
import { AuthorChaptersStore } from './author-chapters.store';

const STORY_ID = 'story-1';

function chapter(id: string, number: number, status: string): AuthorManagedChapterSummary {
  return {
    id,
    storyId: STORY_ID,
    number,
    title: `Chương ${number}`,
    slug: `chuong-${number}`,
    status,
    wordCount: 100,
    pageCount: 0,
    version: 1,
    scheduledAt: null,
    publishedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  } as AuthorManagedChapterSummary;
}

describe('AuthorChaptersStore bulk actions', () => {
  let store: AuthorChaptersStore;
  const repository = {
    getStory: vi.fn(),
    listChapters: vi.fn(),
    submitAllChapters: vi.fn(),
    publishAllChapters: vi.fn(),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    repository.getStory.mockReturnValue(of({ id: STORY_ID, status: 'PUBLISHED' }));
    repository.listChapters.mockReturnValue(
      of([chapter('a', 1, 'DRAFT'), chapter('b', 2, 'APPROVED')]),
    );
    TestBed.configureTestingModule({
      providers: [
        AuthorChaptersStore,
        { provide: AuthorStoryManagementRepository, useValue: repository },
      ],
    });
    store = TestBed.inject(AuthorChaptersStore);
  });

  it('tóm tắt số chương đã gửi duyệt và tải lại danh sách', () => {
    repository.submitAllChapters.mockReturnValue(
      of({ changed: [{ id: 'a' }], skipped: [], remaining: 0 }),
    );

    store.submitAllDrafts(STORY_ID);

    expect(repository.submitAllChapters).toHaveBeenCalledWith(STORY_ID);
    expect(store.success()).toBe('Đã gửi duyệt 1 chương.');
    // Lô đổi hàng chục dòng nên tải lại cả danh sách thay vì vá từng dòng.
    expect(repository.listChapters).toHaveBeenCalledTimes(1);
  });

  /*
   * Phần bị bỏ qua mới là thứ tác giả cần biết. Báo mỗi "đã xong" là họ tưởng
   * hết rồi bỏ đi, để lại chương rỗng nằm im không ai xuất bản.
   */
  it('kể tên từng chương bị bỏ qua kèm lý do', () => {
    repository.publishAllChapters.mockReturnValue(
      of({
        changed: [],
        skipped: [
          {
            chapterId: 'b',
            number: 2,
            title: 'Chương rỗng',
            code: 'CHAPTER_EMPTY_CONTENT',
            message: 'Chương chưa có chữ nào',
          },
        ],
        remaining: 5,
      }),
    );

    store.publishAllApproved(STORY_ID);

    expect(store.success()).toContain('Bỏ qua 1 chương');
    expect(store.success()).toContain('Còn 5 chương');
    expect(store.bulkSkipped()).toEqual(['Chương 2 — Chương rỗng: Chương chưa có chữ nào']);
  });

  it('không chạy lô thứ hai khi lô trước chưa xong', () => {
    repository.submitAllChapters.mockReturnValue(
      throwError(() => new Error('should not run twice')),
    );
    store.bulkBusy.set(true);

    store.submitAllDrafts(STORY_ID);

    expect(repository.submitAllChapters).not.toHaveBeenCalled();
  });
});
