/**
 * A recognised line, with its box normalised against the page it was read
 * from. CommentRegion already stores page rectangles as fractions of the page,
 * so overlays built on top of OCR can use the same maths without knowing the
 * pixel size recognition happened to run at.
 */
export interface OcrLine {
  readonly text: string;
  readonly confidence: number;
  readonly box: OcrBox;
}

export interface OcrBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const MAX_TEXT_LENGTH = 2_000;

export function normaliseOcrBox(
  polygon: readonly (readonly [number, number])[],
  pageWidth: number,
  pageHeight: number,
): OcrBox | null {
  if (polygon.length < 2 || pageWidth <= 0 || pageHeight <= 0) return null;

  const xs = polygon.map(([x]) => x);
  const ys = polygon.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  if (![minX, maxX, minY, maxY].every(Number.isFinite)) return null;

  const box: OcrBox = {
    x: clampFraction(minX / pageWidth),
    y: clampFraction(minY / pageHeight),
    width: clampFraction((maxX - minX) / pageWidth),
    height: clampFraction((maxY - minY) / pageHeight),
  };

  return box.width > 0 && box.height > 0 ? box : null;
}

export function sanitiseOcrText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.replace(/\s+/gu, ' ').trim();
  if (!text) return null;
  return text.length > MAX_TEXT_LENGTH ? text.slice(0, MAX_TEXT_LENGTH) : text;
}

export function clampConfidence(value: unknown): number {
  const confidence = Number(value);
  if (!Number.isFinite(confidence)) return 0;
  return Math.min(1, Math.max(0, Math.round(confidence * 10_000) / 10_000));
}

function clampFraction(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, Math.round(value * 1_000_000) / 1_000_000));
}
