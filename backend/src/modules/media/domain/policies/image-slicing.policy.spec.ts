import { ImageSlicingPolicy } from './image-slicing.policy';

describe('ImageSlicingPolicy', () => {
  it('keeps short images whole', () => {
    expect(ImageSlicingPolicy.calculate(1_999)).toEqual([]);
  });

  it('covers a tall image with balanced bounded slices', () => {
    const slices = ImageSlicingPolicy.calculate(5_001);
    expect(slices).toHaveLength(4);
    expect(slices.every((slice) => slice.height <= 2_000)).toBe(true);
    expect(slices.reduce((sum, slice) => sum + slice.height, 0)).toBe(5_001);
    expect(slices.at(-1)).toMatchObject({ offsetY: 3_753, height: 1_248 });
  });
});
