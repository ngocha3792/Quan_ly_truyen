import { describe, expect, it } from 'vitest';
import { parseChaptersFromText } from './chapter-import';

describe('parseChaptersFromText', () => {
  it('tách bản thảo thành từng chương theo dòng tiêu đề', () => {
    const result = parseChaptersFromText(
      [
        'Chương 1: Khởi đầu',
        'Dòng một.',
        'Dòng hai.',
        '',
        'Chương 2: Gặp gỡ',
        'Nội dung chương hai.',
      ].join('\n'),
    );

    expect(result.chapters).toEqual([
      {
        numberInFile: 1,
        title: 'Khởi đầu',
        content: 'Dòng một.\nDòng hai.',
        wordCount: 4,
      },
      {
        numberInFile: 2,
        title: 'Gặp gỡ',
        content: 'Nội dung chương hai.',
        wordCount: 4,
      },
    ]);
    expect(result.ignoredPreamble).toBe('');
  });

  /*
   * Nuốt im lặng đoạn nằm trước chương đầu tiên là cách chắc chắn để tác giả
   * mất lời tựa mà không biết. Trả nó ra để giao diện hỏi lại.
   */
  it('giữ lại đoạn nằm trước tiêu đề đầu tiên thay vì bỏ đi', () => {
    const result = parseChaptersFromText(
      ['Lời tựa của tác giả.', '', 'Chương 1: Bắt đầu', 'Nội dung.'].join('\n'),
    );

    expect(result.ignoredPreamble).toBe('Lời tựa của tác giả.');
    expect(result.chapters).toHaveLength(1);
  });

  it('nhận dạng gõ không dấu, số thập phân và các dấu ngăn khác nhau', () => {
    const result = parseChaptersFromText(
      [
        'Chuong 1 - Không dấu',
        'a',
        'CHƯƠNG 1.5. Chèn giữa',
        'b',
        'Chương 2 Không có dấu ngăn',
        'c',
      ].join('\n'),
    );

    expect(result.chapters.map((chapter) => [chapter.numberInFile, chapter.title])).toEqual([
      [1, 'Không dấu'],
      [1.5, 'Chèn giữa'],
      [2, 'Không có dấu ngăn'],
    ]);
  });

  it('đặt tên thay cho chương không ghi tên trong file', () => {
    const result = parseChaptersFromText('Chương 7:\nNội dung.');
    expect(result.chapters[0].title).toBe('Chương 7');
  });

  /*
   * Chữ "chương" nằm giữa câu không phải tiêu đề. Bắt nhầm là cắt đôi một
   * chương đang viết dở.
   */
  it('không cắt khi chữ chương nằm giữa câu', () => {
    const result = parseChaptersFromText(
      'Chương 1: Mở đầu\nHắn đọc lại chương 3 một lần nữa.\nRồi ngủ.',
    );

    expect(result.chapters).toHaveLength(1);
    expect(result.chapters[0].content).toContain('chương 3');
  });

  it('trả danh sách rỗng khi file không có tiêu đề chương nào', () => {
    const result = parseChaptersFromText('Chỉ là một đoạn văn xuôi.');
    expect(result.chapters).toEqual([]);
    expect(result.ignoredPreamble).toBe('Chỉ là một đoạn văn xuôi.');
  });

  it('bỏ được chương rỗng phía sau tiêu đề mà không làm hỏng các chương khác', () => {
    const result = parseChaptersFromText('Chương 1: Có chữ\nNội dung.\nChương 2: Rỗng\n\n');

    expect(result.chapters[1]).toMatchObject({ content: '', wordCount: 0 });
  });
});
