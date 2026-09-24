import {
  clampConfidence,
  normaliseOcrBox,
  sanitiseOcrText,
} from './ocr-line.value-object';

describe('normaliseOcrBox', () => {
  it('turns a pixel polygon into fractions of the page', () => {
    const box = normaliseOcrBox(
      [
        [100, 50],
        [300, 50],
        [300, 150],
        [100, 150],
      ],
      1000,
      500,
    );

    expect(box).toEqual({ x: 0.1, y: 0.1, width: 0.2, height: 0.2 });
  });

  it('takes the bounding box of a rotated polygon', () => {
    const box = normaliseOcrBox(
      [
        [10, 0],
        [100, 20],
        [90, 60],
        [0, 40],
      ],
      200,
      100,
    );

    expect(box).toEqual({ x: 0, y: 0, width: 0.5, height: 0.6 });
  });

  it('clamps a box that overflows the page instead of reporting past the edge', () => {
    const box = normaliseOcrBox(
      [
        [0, 0],
        [400, 0],
        [400, 400],
        [0, 400],
      ],
      200,
      200,
    );

    expect(box).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });

  it.each([
    ['a degenerate polygon', [[10, 10]] as [number, number][], 100, 100],
    [
      'a zero width page',
      [
        [0, 0],
        [10, 10],
      ] as [number, number][],
      0,
      100,
    ],
    [
      'a polygon with no area',
      [
        [10, 10],
        [10, 10],
      ] as [number, number][],
      100,
      100,
    ],
  ])('rejects %s', (_label, polygon, width, height) => {
    expect(normaliseOcrBox(polygon, width, height)).toBeNull();
  });
});

describe('sanitiseOcrText', () => {
  it('collapses the whitespace the recogniser emits around lines', () => {
    expect(sanitiseOcrText('  第一章   少年 \n 的觉醒 ')).toBe(
      '第一章 少年 的觉醒',
    );
  });

  it.each([
    ['', null],
    ['   ', null],
    [42, null],
    [null, null],
  ])('returns null for %p', (value, expected) => {
    expect(sanitiseOcrText(value)).toBe(expected);
  });

  it('truncates a line that is implausibly long for a speech bubble', () => {
    expect(sanitiseOcrText('a'.repeat(3_000))).toHaveLength(2_000);
  });
});

describe('clampConfidence', () => {
  it.each([
    [0.99591, 0.9959],
    [1.4, 1],
    [-0.2, 0],
    ['nonsense', 0],
    [undefined, 0],
  ])('maps %p to %p', (value, expected) => {
    expect(clampConfidence(value)).toBe(expected);
  });
});
