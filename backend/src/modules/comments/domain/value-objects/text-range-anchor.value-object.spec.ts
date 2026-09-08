import {
  createTextRangeAnchor,
  reanchorTextRange,
  verifyTextRangeAnchor,
} from './text-range-anchor.value-object';

const blocks = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    text: 'Mở đầu câu chuyện thật bình yên.',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    text: 'Một cơn gió lạ vừa đi ngang qua.',
  },
] as const;

describe('text range anchor', () => {
  it('creates and verifies a server-derived multi-block anchor', () => {
    const anchor = createTextRangeAnchor(
      blocks,
      blocks[0].id,
      7,
      blocks[1].id,
      12,
    );
    expect(anchor).not.toBeNull();
    expect(verifyTextRangeAnchor(anchor!, blocks)).toEqual({
      valid: true,
      quoteText: 'câu chuyện thật bình yên.\n\nMột cơn gió ',
    });
  });

  it('rejects out-of-range and short selections', () => {
    expect(
      createTextRangeAnchor(blocks, blocks[0].id, 0, blocks[0].id, 3),
    ).toBeNull();
    expect(
      createTextRangeAnchor(blocks, blocks[0].id, 0, blocks[0].id, 999),
    ).toBeNull();
  });

  it('reanchors by stable block and quote context after an insertion', () => {
    const anchor = createTextRangeAnchor(
      blocks,
      blocks[0].id,
      7,
      blocks[0].id,
      29,
    )!;
    const edited = [
      { ...blocks[0], text: `Ghi chú. ${blocks[0].text}` },
      blocks[1],
    ];
    const next = reanchorTextRange(anchor, edited);
    expect(next).toMatchObject({
      startBlockId: blocks[0].id,
      startOffset: 16,
      endOffset: 38,
    });
  });

  it('keeps Unicode normalization stable', () => {
    const unicode = [
      { id: blocks[0].id, text: 'Một đoạn tiếng Việt rất dài: café.' },
    ];
    const anchor = createTextRangeAnchor(
      unicode,
      blocks[0].id,
      0,
      blocks[0].id,
      unicode[0].text.length,
    )!;
    expect(verifyTextRangeAnchor(anchor, unicode).valid).toBe(true);
  });
});
