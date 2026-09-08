import type { ReadingCursor } from '../../domain';
import type { ReadingHistoryEntryResultDto } from '../../application';

export const READING_PROGRESS_NAMESPACE = '/reading-progress';
export const READING_PROGRESS_ROOM_PREFIX = 'user:';
export const READING_PROGRESS_UPDATE_EVENT = 'progress:update';
export const READING_PROGRESS_ACK_EVENT = 'progress:ack';
export const READING_PROGRESS_CHANGED_EVENT = 'progress:changed';
export const READING_PROGRESS_CONFLICT_EVENT = 'progress:conflict';
export const READING_PROGRESS_ERROR_EVENT = 'progress:error';
export const READING_PROGRESS_MAX_MESSAGE_BYTES = 2_048;
export const READING_PROGRESS_RATE_LIMIT_MS = 2_000;

export interface ReadingProgressUpdateEvent {
  readonly storyId: string;
  readonly chapterId: string;
  readonly position: number;
  readonly cursor: ReadingCursor;
  readonly baseRevision: number;
  readonly deviceId: string;
  readonly clientEventId: string;
}

export interface ReadingProgressAckEvent {
  readonly storyId: string;
  readonly clientEventId: string;
  readonly duplicate: boolean;
  readonly progress: ReadingHistoryEntryResultDto;
}

export interface ReadingProgressChangedEvent {
  readonly storyId: string;
  readonly sourceDeviceId: string;
  readonly progress: ReadingHistoryEntryResultDto;
}

export interface ReadingProgressConflictEvent {
  readonly storyId: string;
  readonly clientEventId: string;
  readonly expectedRevision: number;
  readonly actualRevision: number;
  readonly progress: ReadingHistoryEntryResultDto | null;
}

export function parseReadingProgressUpdateEvent(
  value: unknown,
): ReadingProgressUpdateEvent | null {
  if (
    !isRecord(value) ||
    typeof value.storyId !== 'string' ||
    !UUID_PATTERN.test(value.storyId) ||
    typeof value.chapterId !== 'string' ||
    !UUID_PATTERN.test(value.chapterId) ||
    !Number.isSafeInteger(value.position) ||
    (value.position as number) < 0 ||
    !isRecord(value.cursor) ||
    !Number.isSafeInteger(value.baseRevision) ||
    (value.baseRevision as number) < 0 ||
    typeof value.deviceId !== 'string' ||
    !UUID_PATTERN.test(value.deviceId) ||
    typeof value.clientEventId !== 'string' ||
    !UUID_PATTERN.test(value.clientEventId)
  ) {
    return null;
  }
  return value as unknown as ReadingProgressUpdateEvent;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
