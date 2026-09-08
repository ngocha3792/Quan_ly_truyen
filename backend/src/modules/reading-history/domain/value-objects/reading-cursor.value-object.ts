import { InvalidInputException } from '@/common/exceptions';

export const READING_CURSOR_SCHEMA_VERSION = 1 as const;

export interface TextReadingCursor {
  readonly schemaVersion: typeof READING_CURSOR_SCHEMA_VERSION;
  readonly kind: 'text';
  readonly blockId: string;
  readonly characterOffset: number;
  readonly viewportRatio: number;
}

export interface ComicReadingCursor {
  readonly schemaVersion: typeof READING_CURSOR_SCHEMA_VERSION;
  readonly kind: 'comic';
  readonly mediaAssetId?: string;
  readonly sliceId?: string;
  readonly relativeY: number;
}

export type ReadingCursor = TextReadingCursor | ComicReadingCursor;

export function parseReadingCursor(value: unknown): ReadingCursor {
  if (!isRecord(value) || value.schemaVersion !== 1) {
    throw invalidCursor('schemaVersion phải bằng 1');
  }

  if (value.kind === 'text') {
    if (
      typeof value.blockId !== 'string' ||
      !UUID_PATTERN.test(value.blockId) ||
      !isNonNegativeInteger(value.characterOffset) ||
      !isRatio(value.viewportRatio)
    ) {
      throw invalidCursor(
        'text cursor cần blockId UUID, characterOffset nguyên không âm và viewportRatio từ 0 đến 1',
      );
    }

    return {
      schemaVersion: 1,
      kind: 'text',
      blockId: value.blockId,
      characterOffset: value.characterOffset,
      viewportRatio: value.viewportRatio,
    };
  }

  if (value.kind === 'comic') {
    const mediaAssetId = optionalUuid(value.mediaAssetId);
    const sliceId = optionalUuid(value.sliceId);
    if ((!mediaAssetId && !sliceId) || !isRatio(value.relativeY)) {
      throw invalidCursor(
        'comic cursor cần mediaAssetId hoặc sliceId UUID và relativeY từ 0 đến 1',
      );
    }

    return {
      schemaVersion: 1,
      kind: 'comic',
      ...(mediaAssetId ? { mediaAssetId } : {}),
      ...(sliceId ? { sliceId } : {}),
      relativeY: value.relativeY,
    };
  }

  throw invalidCursor('kind phải là text hoặc comic');
}

function invalidCursor(reason: string): InvalidInputException {
  return new InvalidInputException({
    code: 'READING_CURSOR_INVALID',
    message: 'Vị trí đọc không hợp lệ',
    details: { reason },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isRatio(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
  );
}

function optionalUuid(value: unknown): string | undefined {
  return typeof value === 'string' && UUID_PATTERN.test(value)
    ? value
    : undefined;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
