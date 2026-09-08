import { InvalidInputException } from '@/common/exceptions';

export interface ReadingProgressSyncMetadata {
  readonly baseRevision: number;
  readonly deviceId: string;
  readonly clientEventId: string;
}

export function parseReadingProgressSyncMetadata(
  value: unknown,
): ReadingProgressSyncMetadata {
  if (
    !isRecord(value) ||
    !Number.isSafeInteger(value.baseRevision) ||
    (value.baseRevision as number) < 0 ||
    typeof value.deviceId !== 'string' ||
    !UUID_PATTERN.test(value.deviceId) ||
    typeof value.clientEventId !== 'string' ||
    !UUID_PATTERN.test(value.clientEventId)
  ) {
    throw new InvalidInputException({
      code: 'READING_PROGRESS_SYNC_METADATA_INVALID',
      message: 'Thông tin đồng bộ tiến độ đọc không hợp lệ',
    });
  }

  return {
    baseRevision: value.baseRevision as number,
    deviceId: value.deviceId,
    clientEventId: value.clientEventId,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
