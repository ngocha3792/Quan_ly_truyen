import { describe, expect, it } from 'vitest';
import {
  imagePlaceholder,
  pairCreatedChapters,
  parseChaptersFromText,
  ParsedImportChapter,
  readImageIndexes,
  resolveImagePlaceholders,
} from './chapter-import';

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
        imageIndexes: [],
      },
      {
        numberInFile: 2,
        title: 'Gặp gỡ',
        content: 'Nội dung chương hai.',
        wordCount: 4,
        imageIndexes: [],
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

describe('ảnh trong bản thảo', () => {
  function imageLine(index: number, alt = 'Ảnh'): string {
    return `![${alt}](${imagePlaceholder(index)})`;
  }

  it('ghi nhận chương nào trỏ tới ảnh nào', () => {
    const result = parseChaptersFromText(
      [
        'Chương 1: Khởi đầu',
        'Trời đổ mưa.',
        imageLine(0, 'Cảnh mưa'),
        'Hắn bước ra.',
        'Chương 2: Gặp gỡ',
        imageLine(1, 'Chân dung'),
        'Nàng đứng đó.',
        'Chương 3: Lặng lẽ',
        'Không có ảnh nào.',
      ].join('\n'),
    );

    // Đây là điều kiện để ảnh vào đúng chương chứ không lệch một nhịp.
    expect(result.chapters.map((chapter) => chapter.imageIndexes)).toEqual([[0], [1], []]);
  });

  it('gom ảnh trùng chỉ số trong cùng một chương thành một', () => {
    const result = parseChaptersFromText(
      ['Chương 1: Một', imageLine(0), 'Giữa bài.', imageLine(0)].join('\n'),
    );

    expect(result.chapters[0].imageIndexes).toEqual([0]);
  });

  it('không nhận placeholder nằm ngoài cú pháp ảnh', () => {
    // Tác giả gõ đúng chuỗi đó thành chữ thường thì không phải ảnh.
    expect(readImageIndexes(`Xem ${imagePlaceholder(3)} nhé`)).toEqual([]);
    expect(readImageIndexes(`[Không phải ảnh](${imagePlaceholder(3)})`)).toEqual([]);
  });

  it('không đụng vào đường dẫn ảnh thật mà tác giả tự gõ', () => {
    const content = '![Ảnh ngoài](https://example.com/anh.png)';

    expect(readImageIndexes(content)).toEqual([]);
    expect(resolveImagePlaceholders(content, new Map())).toBe(content);
  });

  it('đổi placeholder thành URL thật, giữ nguyên alt text', () => {
    const content = ['Trước ảnh.', imageLine(0, 'Cảnh mưa'), 'Sau ảnh.'].join('\n');

    const resolved = resolveImagePlaceholders(content, new Map([[0, 'https://cdn.test/anh.webp']]));

    expect(resolved).toBe(
      ['Trước ảnh.', '![Cảnh mưa](https://cdn.test/anh.webp)', 'Sau ảnh.'].join('\n'),
    );
  });

  it('xoá hẳn ảnh tải lên thất bại thay vì để lại markdown hỏng', () => {
    const content = ['Trước ảnh.', imageLine(0), 'Sau ảnh.'].join('\n');

    const resolved = resolveImagePlaceholders(content, new Map());

    // Giữ placeholder là chương xuất bản ra với một tấm ảnh hỏng.
    expect(resolved).not.toContain('qlt-anh-nhap');
    expect(resolved).not.toContain('![');
    expect(resolved).toBe(['Trước ảnh.', 'Sau ảnh.'].join('\n'));
  });

  it('xử lý được chương vừa có ảnh thành công vừa có ảnh thất bại', () => {
    const content = ['Mở đầu.', imageLine(0, 'Được'), imageLine(1, 'Mất'), 'Kết.'].join('\n');

    const resolved = resolveImagePlaceholders(content, new Map([[0, 'https://cdn.test/a.webp']]));

    expect(resolved).toBe(['Mở đầu.', '![Được](https://cdn.test/a.webp)', 'Kết.'].join('\n'));
  });

  it('không bị ảnh hưởng bởi thứ tự gọi hai hàm', () => {
    // Regex có cờ `g` dùng chung sẽ mang theo lastIndex và làm lần gọi sau lệch.
    const content = [imageLine(0), imageLine(1)].join('\n');

    expect(readImageIndexes(content)).toEqual([0, 1]);
    resolveImagePlaceholders(content, new Map([[0, 'https://cdn.test/a.webp']]));
    expect(readImageIndexes(content)).toEqual([0, 1]);
  });

  it('giữ đúng khoảng cách đoạn khi bỏ ảnh giữa hai đoạn', () => {
    // Đây là hình dạng thật từ docx: mammoth cho mỗi đoạn một dòng, cách nhau
    // một dòng trống.
    const content = ['Trước ảnh.', '', imageLine(0), '', 'Sau ảnh.'].join('\n');

    expect(resolveImagePlaceholders(content, new Map())).toBe('Trước ảnh.\n\nSau ảnh.');
  });

  it('không gộp khoảng trắng khi không bỏ dòng nào', () => {
    // Tác giả cố ý gõ nhiều dòng trống thì để nguyên.
    const content = ['Đoạn một.', '', '', '', 'Đoạn hai.'].join('\n');

    expect(resolveImagePlaceholders(content, new Map())).toBe(content);
  });

  it('bỏ ảnh đứng một mình ở đầu chương', () => {
    const content = [imageLine(0), '', 'Chữ sau ảnh.'].join('\n');

    expect(resolveImagePlaceholders(content, new Map())).toBe('Chữ sau ảnh.');
  });

  it('giữ chữ đi cùng dòng với ảnh bị bỏ', () => {
    // Dòng không chỉ có ảnh thì không được xoá cả dòng.
    const content = `Chú thích: ${imageLine(0)} hết.`;

    expect(resolveImagePlaceholders(content, new Map())).toBe('Chú thích:  hết.');
  });
});

describe('pairCreatedChapters', () => {
  function chapter(title: string): ParsedImportChapter {
    return { numberInFile: 1, title, content: title, wordCount: 1, imageIndexes: [] };
  }

  const batch = [chapter('Một'), chapter('Hai'), chapter('Ba'), chapter('Bốn')];

  it('ghép một-một khi không chương nào bị bỏ', () => {
    const paired = pairCreatedChapters(batch, ['id1', 'id2', 'id3', 'id4'], []);

    expect(paired.map((pair) => [pair.created, pair.parsed.title])).toEqual([
      ['id1', 'Một'],
      ['id2', 'Hai'],
      ['id3', 'Ba'],
      ['id4', 'Bốn'],
    ]);
  });

  it('bỏ qua đúng chương bị máy chủ từ chối, không lệch nhịp', () => {
    // Chương "Hai" bị bỏ: id2 phải là "Ba", không phải "Hai".
    const paired = pairCreatedChapters(batch, ['id1', 'id2', 'id3'], [1]);

    expect(paired.map((pair) => [pair.created, pair.parsed.title])).toEqual([
      ['id1', 'Một'],
      ['id2', 'Ba'],
      ['id3', 'Bốn'],
    ]);
  });

  it('ghép đúng khi nhiều chương bị bỏ, kể cả chương đầu', () => {
    const paired = pairCreatedChapters(batch, ['idA', 'idB'], [0, 2]);

    expect(paired.map((pair) => pair.parsed.title)).toEqual(['Hai', 'Bốn']);
  });

  it('ghép được khi máy chủ dừng sớm giữa lô', () => {
    // Truyện không còn: created ngắn hơn cả phần chưa bị bỏ.
    const paired = pairCreatedChapters(batch, ['id1'], []);

    expect(paired.map((pair) => pair.parsed.title)).toEqual(['Một']);
  });

  it('không ghép quá số chương đã gửi', () => {
    // Máy chủ trả về nhiều hơn yêu cầu thì thà ghép thiếu còn hơn ghép sai.
    const paired = pairCreatedChapters([chapter('Một')], ['id1', 'id2'], []);

    expect(paired).toHaveLength(1);
    expect(paired[0].parsed.title).toBe('Một');
  });

  it('trả về rỗng khi không tạo được chương nào', () => {
    expect(pairCreatedChapters(batch, [], [0, 1, 2, 3])).toEqual([]);
  });
});
