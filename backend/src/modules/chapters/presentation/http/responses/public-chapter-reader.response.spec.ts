import type { PublicChapterReaderDto } from '../../../application';

import { toPublicChapterReaderResponse } from './public-chapter-reader.response';

function readerDto(
  blocks: readonly { id: string; type: string; text: string }[],
): PublicChapterReaderDto {
  return {
    story: { id: 'story-1', slug: 'truyen', title: 'Truyện' },
    chapter: {
      id: 'chapter-1',
      number: 1,
      title: 'Chương 1',
      slug: 'chuong-1',
      wordCount: 10,
      views: 0,
      comments: 0,
      publishedAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      access: { state: 'FREE', priceCredits: null },
      content: '',
      contentFormat: 'markdown',
      contentDocument: {
        schemaVersion: 1,
        blocks: blocks.map((block) => ({ ...block, marks: [] })),
      },
      documentSchemaVersion: 1,
    },
    navigation: { previous: null, next: null },
  } as unknown as PublicChapterReaderDto;
}

function readerBlocks(dto: PublicChapterReaderDto) {
  const chapter = toPublicChapterReaderResponse(dto).chapter;
  if (!('contentDocument' in chapter) || !chapter.contentDocument) {
    throw new Error('Response thiếu content document');
  }
  return chapter.contentDocument.blocks;
}

describe('toPublicChapterReaderResponse', () => {
  it('turns a Markdown-image paragraph into an image block the reader can render', () => {
    const blocks = readerBlocks(
      readerDto([
        { id: 'b1', type: 'paragraph', text: 'Hắn mở cửa.' },
        {
          id: 'b2',
          type: 'paragraph',
          text: '![Cảnh mở đầu](https://cdn.test/a.jpg)',
        },
      ]),
    );

    expect(blocks[0]).toMatchObject({ id: 'b1', type: 'paragraph' });
    expect(blocks[1]).toMatchObject({
      id: 'b2',
      type: 'image',
      url: 'https://cdn.test/a.jpg',
      alt: 'Cảnh mở đầu',
    });
  });

  it('keeps the original Markdown in text so offline and legacy clients still work', () => {
    const [block] = readerBlocks(
      readerDto([
        { id: 'b1', type: 'paragraph', text: '![a](https://cdn.test/a.jpg)' },
      ]),
    );

    expect(block.text).toBe('![a](https://cdn.test/a.jpg)');
  });

  it('splits a paragraph that mixes an image with text into segments', () => {
    // Trình soạn thảo chèn ảnh ngay cạnh chữ nên cả hai nằm chung một block;
    // nếu không cắt ra, reader in nguyên chuỗi Markdown lên màn hình.
    const markdown = '![anh](https://cdn.test/a.jpg)';
    const [block] = readerBlocks(
      readerDto([{ id: 'b1', type: 'paragraph', text: `${markdown}A` }]),
    );

    expect(block.type).toBe('paragraph');
    expect(block).toMatchObject({
      segments: [
        {
          type: 'image',
          url: 'https://cdn.test/a.jpg',
          alt: 'anh',
          offset: 0,
          length: markdown.length,
        },
        { type: 'text', text: 'A', offset: markdown.length },
      ],
    });
    // Text nguồn giữ nguyên để neo bình luận vẫn cắt đúng.
    expect(block.text).toBe(`${markdown}A`);
  });

  it('leaves a paragraph without any image free of segments', () => {
    const [block] = readerBlocks(
      readerDto([{ id: 'b1', type: 'paragraph', text: 'Hắn mở cửa.' }]),
    );

    expect(block).not.toHaveProperty('segments');
  });

  it('leaves an unsafe image target as an ordinary paragraph', () => {
    const [block] = readerBlocks(
      readerDto([
        { id: 'b1', type: 'paragraph', text: '![x](javascript:alert(1))' },
      ]),
    );

    expect(block.type).toBe('paragraph');
    expect(block).not.toHaveProperty('url');
  });

  it('marks a heading with its level and the prefix length the reader hides', () => {
    const [block] = readerBlocks(
      readerDto([{ id: 'b1', type: 'heading', text: '### Hồi thứ ba' }]),
    );

    expect(block).toMatchObject({ type: 'heading', level: 3, textOffset: 4 });
    // Text nguồn giữ nguyên để neo bình luận vẫn cắt đúng.
    expect(block.text).toBe('### Hồi thứ ba');
  });

  it('leaves a heading without a usable prefix untouched', () => {
    const [block] = readerBlocks(
      readerDto([{ id: 'b1', type: 'heading', text: '#KhongCoKhoangTrang' }]),
    );

    expect(block).not.toHaveProperty('textOffset');
  });

  it('never rewrites a block that is not a paragraph', () => {
    const [block] = readerBlocks(
      readerDto([
        { id: 'b1', type: 'code', text: '![a](https://cdn.test/a.jpg)' },
      ]),
    );

    expect(block.type).toBe('code');
  });
});
