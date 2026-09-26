import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthorStoryManagementRepository } from '../domain/author-story-management.repository';
import { ChapterFileReaderService } from './chapter-file-reader.service';
import { ChapterImportStore } from './chapter-import.store';

const STORY_ID = 'story-1';

function draftFile(text: string): File {
  return new File([text], 'ban-thao.txt', { type: 'text/plain' });
}

describe('ChapterImportStore', () => {
  let store: ChapterImportStore;
  const reader = { readAsText: vi.fn() };
  const repository = { importChapters: vi.fn() };

  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.configureTestingModule({
      providers: [
        ChapterImportStore,
        { provide: ChapterFileReaderService, useValue: reader },
        { provide: AuthorStoryManagementRepository, useValue: repository },
      ],
    });
    store = TestBed.inject(ChapterImportStore);
  });

  it('đọc file rồi tách chương mà chưa gửi gì lên máy chủ', async () => {
    reader.readAsText.mockResolvedValue('Chương 1: Mở đầu\nNội dung.');

    await store.choose(draftFile('bỏ qua, reader đã bị mock'));

    expect(store.parsed()?.chapters).toHaveLength(1);
    expect(store.fileName()).toBe('ban-thao.txt');
    // Xem trước là xem trước: không được tạo gì cho tới khi tác giả bấm xác nhận.
    expect(repository.importChapters).not.toHaveBeenCalled();
  });

  it('báo lỗi đọc file bằng đúng câu của bộ đọc', async () => {
    reader.readAsText.mockRejectedValue(new Error('File quá lớn.'));

    await store.choose(draftFile('x'));

    expect(store.error()).toBe('File quá lớn.');
    expect(store.fileName()).toBeNull();
  });

  /*
   * Máy chủ chỉ nhận 50 chương mỗi lần. Bản thảo dài phải được chia lô, không
   * thì lô đầu đã bị từ chối và tác giả không nhập được gì.
   */
  it('chia bản thảo dài thành nhiều lô theo trần của máy chủ', async () => {
    const draft = Array.from(
      { length: 120 },
      (_, index) => `Chương ${index + 1}: Tên\nNội dung.`,
    ).join('\n');
    reader.readAsText.mockResolvedValue(draft);
    repository.importChapters.mockImplementation((_id: string, chapters: unknown[]) =>
      of({ created: chapters.map(() => ({ id: 'x', number: 1 })), skipped: [] }),
    );

    await store.choose(draftFile('x'));
    expect(await store.importAll(STORY_ID)).toBe(true);

    expect(repository.importChapters).toHaveBeenCalledTimes(3);
    expect(
      (repository.importChapters.mock.calls as [string, unknown[]][]).map((call) => call[1].length),
    ).toEqual([50, 50, 20]);
    expect(store.importedCount()).toBe(120);
  });

  /*
   * Lô thứ hai hỏng không xoá được 50 chương lô đầu đã tạo. Nói đúng số đã vào
   * còn hơn để tác giả bấm lại và nhân đôi mọi thứ.
   */
  it('giữ và báo số chương đã tạo khi một lô giữa chừng hỏng', async () => {
    const draft = Array.from(
      { length: 60 },
      (_, index) => `Chương ${index + 1}: Tên\nNội dung.`,
    ).join('\n');
    reader.readAsText.mockResolvedValue(draft);
    repository.importChapters
      .mockReturnValueOnce(
        of({ created: Array.from({ length: 50 }, () => ({ id: 'x', number: 1 })), skipped: [] }),
      )
      .mockReturnValueOnce(throwError(() => new Error('mạng hỏng')));

    await store.choose(draftFile('x'));
    expect(await store.importAll(STORY_ID)).toBe(false);

    expect(store.importedCount()).toBe(50);
    expect(store.error()).toContain('Đã tạo được 50 chương trước khi dừng');
  });

  it('không nhập khi file không tách được chương nào', async () => {
    reader.readAsText.mockResolvedValue('Chỉ là văn xuôi.');

    await store.choose(draftFile('x'));
    expect(await store.importAll(STORY_ID)).toBe(false);

    expect(repository.importChapters).not.toHaveBeenCalled();
  });
});
