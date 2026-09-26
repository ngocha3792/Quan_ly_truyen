import { describe, expect, it } from 'vitest';
import {
  describeSkippedBulkChapters,
  summariseBulkChapterResult,
} from './bulk-chapter-result.util';

const skipped = [{ number: 2, title: 'Chương rỗng', message: 'Chương chưa có chữ nào' }];

describe('summariseBulkChapterResult', () => {
  it('chỉ nói phần đã xong khi không có gì vướng', () => {
    const notice = summariseBulkChapterResult(
      { changed: [1, 2, 3], skipped: [], remaining: 0 },
      'duyệt',
    );
    expect(notice).toBe('Đã duyệt 3 chương.');
  });

  /*
   * Lô chạy từng chương nên gần như lúc nào cũng có phần vướng. Giấu nó đi là
   * người bấm tưởng xong hết rồi bỏ đi.
   */
  it('nói cả phần bị bỏ qua', () => {
    const notice = summariseBulkChapterResult({ changed: [1], skipped, remaining: 0 }, 'duyệt');
    expect(notice).toContain('Bỏ qua 1 chương');
  });

  it('nói số còn lại khi lô bị cắt vì vượt trần', () => {
    const notice = summariseBulkChapterResult(
      { changed: [1], skipped: [], remaining: 40 },
      'xuất bản',
    );
    expect(notice).toContain('Còn 40 chương');
    expect(notice).toContain('bấm lại');
  });
});

describe('describeSkippedBulkChapters', () => {
  it('mỗi chương vướng một dòng, có số, tên và lý do', () => {
    expect(describeSkippedBulkChapters({ changed: [], skipped, remaining: 0 })).toEqual([
      'Chương 2 — Chương rỗng: Chương chưa có chữ nào',
    ]);
  });
});
