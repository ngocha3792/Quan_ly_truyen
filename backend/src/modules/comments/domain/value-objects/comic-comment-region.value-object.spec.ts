import { isComicCommentRegion } from './comic-comment-region.value-object';

describe('isComicCommentRegion', () => {
  it('accepts resolution-independent normalized bounds', () => {
    expect(
      isComicCommentRegion({ x: 0.2, y: 0.3, width: 0.1, height: 0.2 }),
    ).toBe(true);
  });

  it.each([
    { x: -0.1, y: 0, width: 0.1, height: 0.1 },
    { x: 0.9, y: 0, width: 0.2, height: 0.1 },
    { x: 0, y: 0, width: 0, height: 0.1 },
  ])('rejects invalid bounds %#', (region) => {
    expect(isComicCommentRegion(region)).toBe(false);
  });
});
