export interface ComicCommentRegion {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export function isComicCommentRegion(value: ComicCommentRegion): boolean {
  const coordinates = [value.x, value.y, value.width, value.height];
  return (
    coordinates.every(Number.isFinite) &&
    value.x >= 0 &&
    value.y >= 0 &&
    value.width > 0 &&
    value.height > 0 &&
    value.x + value.width <= 1 &&
    value.y + value.height <= 1
  );
}
