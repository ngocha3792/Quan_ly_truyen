import { describe, expect, it } from 'vitest';
import { describeInsertAnchor, readInsertAnchor } from './chapter-insert-anchor';

function params(values: Record<string, string>) {
  return { get: (key: string) => values[key] ?? null };
}

describe('readInsertAnchor', () => {
  it('đọc mốc chèn phía sau từ chen-sau', () => {
    expect(readInsertAnchor(params({ 'chen-sau': 'abc' }))).toEqual({
      afterChapterId: 'abc',
    });
  });

  it('đọc mốc chèn phía trước từ chen-truoc', () => {
    expect(readInsertAnchor(params({ 'chen-truoc': 'abc' }))).toEqual({
      beforeChapterId: 'abc',
    });
  });

  /*
   * Không có mốc thì phải là object rỗng, không phải object có khoá undefined:
   * store gửi thẳng nó lên máy chủ ở lần tạo đầu.
   */
  it('không sinh khoá nào khi URL không mang mốc chèn', () => {
    expect(readInsertAnchor(params({}))).toEqual({});
  });
});

describe('describeInsertAnchor', () => {
  it('nói rõ chương sẽ thành chương mở đầu', () => {
    expect(describeInsertAnchor({ beforeChapterId: 'abc' })).toContain('chương mở đầu');
  });

  it('nói rõ chương sẽ nằm sau chương đã chọn', () => {
    const notice = describeInsertAnchor({ afterChapterId: 'abc' });
    expect(notice).toContain('ngay sau chương bạn đã chọn');
    expect(notice).not.toContain('mở đầu');
  });

  it('không nói gì khi chương chỉ thêm vào đuôi truyện', () => {
    expect(describeInsertAnchor({})).toBeNull();
  });
});
