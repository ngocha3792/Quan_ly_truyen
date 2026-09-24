import {
  resolveChapterImageBlock,
  resolveChapterInlineImages,
  stripChapterImageMarkdown,
} from './chapter-image-block.value-object';

describe('resolveChapterImageBlock', () => {
  it('reads a Markdown image with alt text', () => {
    expect(
      resolveChapterImageBlock('![Bìa chương](https://cdn.test/anh.jpg)'),
    ).toEqual({ url: 'https://cdn.test/anh.jpg', alt: 'Bìa chương' });
  });

  it('accepts an empty alt and an optional title', () => {
    expect(
      resolveChapterImageBlock('![](https://cdn.test/anh.png "Chú thích")'),
    ).toEqual({ url: 'https://cdn.test/anh.png', alt: '' });
  });

  it('accepts a bare image URL standing alone', () => {
    expect(
      resolveChapterImageBlock('  https://cdn.test/trang-01.webp  '),
    ).toEqual({
      url: 'https://cdn.test/trang-01.webp',
      alt: '',
    });
  });

  it('accepts a bare image URL carrying a query string', () => {
    expect(resolveChapterImageBlock('https://cdn.test/trang.jpg?v=2')).toEqual({
      url: 'https://cdn.test/trang.jpg?v=2',
      alt: '',
    });
  });

  it.each([
    ['javascript:alert(1)', '![x](javascript:alert(1))'],
    ['data URI', '![x](data:image/png;base64,AAAA)'],
    ['vbscript', '![x](vbscript:msgbox)'],
    ['protocol-relative', '![x](//cdn.test/anh.jpg)'],
  ])('rejects an unsafe %s target', (_label, text) => {
    expect(resolveChapterImageBlock(text)).toBeNull();
  });

  it('leaves a paragraph that only mentions an image alone', () => {
    expect(
      resolveChapterImageBlock('Xem ảnh tại ![x](https://cdn.test/a.jpg) nhé'),
    ).toBeNull();
  });

  it('leaves a bare link that is not an image alone', () => {
    expect(resolveChapterImageBlock('https://cdn.test/bai-viet')).toBeNull();
  });

  it('leaves ordinary prose alone', () => {
    expect(resolveChapterImageBlock('Hắn bước vào căn phòng tối.')).toBeNull();
  });

  it('does not treat a multi-line block as a single image', () => {
    expect(
      resolveChapterImageBlock('![a](https://cdn.test/a.jpg)\nDòng hai'),
    ).toBeNull();
  });
});

describe('resolveChapterInlineImages', () => {
  const URL = 'https://cdn.test/anh.jpg';

  it('cắt ảnh do editor chèn giữa câu chữ ra khỏi phần chữ', () => {
    // Đúng dạng gây lỗi trên production: editor chèn ảnh ngay trước chữ nên
    // cả hai nằm chung một block và reader in ra nguyên chuỗi Markdown.
    const markdown = `![anh](${URL})`;

    expect(resolveChapterInlineImages(`${markdown}A`)).toEqual([
      {
        type: 'image',
        url: URL,
        alt: 'anh',
        offset: 0,
        length: markdown.length,
      },
      { type: 'text', text: 'A', offset: markdown.length },
    ]);
  });

  it('giữ offset theo text nguồn để neo bình luận vẫn cắt đúng', () => {
    const text = `Trước ![x](${URL}) sau`;
    const segments = resolveChapterInlineImages(text);

    expect(segments).toHaveLength(3);
    for (const segment of segments ?? []) {
      if (segment.type === 'text') {
        expect(
          text.slice(segment.offset, segment.offset + segment.text.length),
        ).toBe(segment.text);
      } else {
        expect(
          text.slice(segment.offset, segment.offset + segment.length),
        ).toBe(`![x](${URL})`);
      }
    }
  });

  it('xử lý nhiều ảnh trong cùng một block', () => {
    const segments = resolveChapterInlineImages(`![a](${URL})giữa![b](${URL})`);

    expect(segments?.map((segment) => segment.type)).toEqual([
      'image',
      'text',
      'image',
    ]);
  });

  it('bỏ qua ảnh có scheme không an toàn, để nguyên trong phần chữ', () => {
    expect(
      resolveChapterInlineImages('![x](javascript:alert(1)) còn chữ'),
    ).toBeNull();
  });

  it('trả null khi block không có ảnh nào', () => {
    expect(
      resolveChapterInlineImages('Hắn bước vào căn phòng tối.'),
    ).toBeNull();
  });
});

describe('stripChapterImageMarkdown', () => {
  it('bỏ Markdown ảnh để giọng đọc không phát ra URL', () => {
    expect(
      stripChapterImageMarkdown('Trước ![x](https://cdn.test/a.jpg) sau'),
    ).toBe('Trước sau');
  });

  it('trả chuỗi rỗng khi block chỉ có ảnh', () => {
    expect(stripChapterImageMarkdown('![x](https://cdn.test/a.jpg)')).toBe('');
  });

  it('giữ nguyên chữ khi không có ảnh', () => {
    expect(stripChapterImageMarkdown('Hắn mở cửa.')).toBe('Hắn mở cửa.');
  });
});
