import {
  createBackfilledChapterContentDocument,
  createChapterContentDocument,
  isChapterContentDocument,
} from './chapter-content-document.value-object';

describe('chapter content document', () => {
  const ids = [
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    '33333333-3333-4333-8333-333333333333',
    '44444444-4444-4444-8444-444444444444',
  ];

  it('converts Markdown into versioned blocks', () => {
    let index = 0;
    const document = createChapterContentDocument(
      '# Chương 1\n\nĐoạn đầu.\n\n> Trích dẫn',
      null,
      () => ids[index++],
    );

    expect(document).toEqual({
      schemaVersion: 1,
      blocks: [
        { id: ids[0], type: 'heading', text: '# Chương 1', marks: [] },
        { id: ids[1], type: 'paragraph', text: 'Đoạn đầu.', marks: [] },
        { id: ids[2], type: 'blockquote', text: '> Trích dẫn', marks: [] },
      ],
    });
    expect(isChapterContentDocument(document)).toBe(true);
  });

  it('keeps unchanged block IDs when a block is inserted', () => {
    let index = 0;
    const previous = createChapterContentDocument(
      'Một\n\nHai',
      null,
      () => ids[index++],
    );
    const next = createChapterContentDocument(
      'Mở đầu\n\nMột\n\nHai',
      previous,
      () => ids[index++],
    );

    expect(next.blocks.map((block) => block.id)).toEqual([
      ids[2],
      ids[0],
      ids[1],
    ]);
  });

  it('keeps the block ID for an in-place text edit', () => {
    let index = 0;
    const previous = createChapterContentDocument(
      'Một\n\nHai',
      null,
      () => ids[index++],
    );
    const next = createChapterContentDocument(
      'Một đã sửa\n\nHai',
      previous,
      () => ids[index++],
    );

    expect(next.blocks.map((block) => block.id)).toEqual([ids[0], ids[1]]);
  });

  it('does not let an inserted paragraph steal an edited paragraph ID', () => {
    let index = 0;
    const previous = createChapterContentDocument(
      'Đoạn văn cần chỉnh sửa\n\nĐoạn cuối',
      null,
      () => ids[index++],
    );
    const next = createChapterContentDocument(
      'Lời dẫn mới\n\nĐoạn văn đã chỉnh sửa\n\nĐoạn cuối',
      previous,
      () => ids[index++],
    );

    expect(next.blocks.map((block) => block.id)).toEqual([
      ids[2],
      ids[0],
      ids[1],
    ]);
  });

  it('keeps blank lines inside a fenced code block', () => {
    let index = 0;
    const document = createChapterContentDocument(
      '```ts\nconst first = 1;\n\nconst second = 2;\n```\n\nSau code.',
      null,
      () => ids[index++],
    );

    expect(document.blocks).toEqual([
      {
        id: ids[0],
        type: 'code',
        text: '```ts\nconst first = 1;\n\nconst second = 2;\n```',
        marks: [],
      },
      { id: ids[1], type: 'paragraph', text: 'Sau code.', marks: [] },
    ]);
  });

  it('reconstructs rollback-window rows with deterministic IDs', () => {
    const first = createBackfilledChapterContentDocument(
      'Một\n\nHai',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    );
    const second = createBackfilledChapterContentDocument(
      'Một\n\nHai',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    );

    expect(second).toEqual(first);
    expect(isChapterContentDocument(first)).toBe(true);
  });

  it('rejects malformed marks in stored documents', () => {
    expect(
      isChapterContentDocument({
        schemaVersion: 1,
        blocks: [
          {
            id: ids[0],
            type: 'paragraph',
            text: 'abc',
            marks: [{ type: 'link', from: 0, to: 10 }],
          },
        ],
      }),
    ).toBe(false);
  });
});
