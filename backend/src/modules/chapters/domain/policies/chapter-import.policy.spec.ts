import { ChapterImportPolicy } from './chapter-import.policy';

describe('ChapterImportPolicy', () => {
  /*
   * Mỗi chương là một giao dịch riêng có khoá truyện. Không chặn trần thì một
   * bản thảo nghìn chương làm request chết giữa đường, để lại nửa số chương
   * đã tạo mà tác giả không biết tới đâu.
   */
  it('chặn trần số chương mỗi lần gọi', () => {
    expect(ChapterImportPolicy.MAX_PER_CALL).toBeGreaterThan(0);
    expect(ChapterImportPolicy.MAX_PER_CALL).toBeLessThanOrEqual(100);
  });

  /*
   * Cột `content` là `text`, không có trần ở tầng database. Một file hỏng sẽ
   * thành một chương vài chục megabyte nằm lại trong bảng.
   */
  it('chặn trần độ dài một chương', () => {
    expect(ChapterImportPolicy.MAX_CONTENT_LENGTH).toBeGreaterThan(100_000);
  });
});
