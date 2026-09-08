export interface ImageSliceSpec {
  readonly index: number;
  readonly offsetY: number;
  readonly height: number;
}

export class ImageSlicingPolicy {
  static readonly MIN_HEIGHT = 2_000;
  static readonly TARGET_HEIGHT = 1_600;
  static readonly MAX_HEIGHT = 2_000;

  static calculate(height: number): readonly ImageSliceSpec[] {
    if (!Number.isSafeInteger(height) || height < this.MIN_HEIGHT) return [];
    const count = Math.ceil(height / this.TARGET_HEIGHT);
    const balancedHeight = Math.ceil(height / count);
    return Array.from({ length: count }, (_, index) => {
      const offsetY = index * balancedHeight;
      return {
        index,
        offsetY,
        height: Math.min(balancedHeight, height - offsetY),
      };
    });
  }
}
