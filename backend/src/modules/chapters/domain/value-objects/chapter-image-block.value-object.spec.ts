import {
  isChapterImageBlock,
  resolveChapterImageBlock,
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

describe('isChapterImageBlock', () => {
  it('flags a paragraph that is only an image', () => {
    expect(
      isChapterImageBlock({
        type: 'paragraph',
        text: '![a](https://cdn.test/a.jpg)',
      }),
    ).toBe(true);
  });

  it('does not flag other block types carrying the same text', () => {
    expect(
      isChapterImageBlock({
        type: 'code',
        text: '![a](https://cdn.test/a.jpg)',
      }),
    ).toBe(false);
  });

  it('does not flag prose', () => {
    expect(isChapterImageBlock({ type: 'paragraph', text: 'Xin chào' })).toBe(
      false,
    );
  });
});
