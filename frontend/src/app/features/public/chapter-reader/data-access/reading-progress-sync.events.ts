import type {
  ReadingCursorApi,
  ReadingHistoryApiItem,
} from '../../../../core/http/reader-engagement-api.model';

export const READING_PROGRESS_SEND_INTERVAL_MS = 3_000;
export const READING_PROGRESS_NAMESPACE = '/reading-progress';

export function progressSendDelay(blockChanged: boolean, elapsedMs: number): number {
  return blockChanged
    ? Math.max(0, READING_PROGRESS_SEND_INTERVAL_MS - elapsedMs)
    : READING_PROGRESS_SEND_INTERVAL_MS;
}

export interface ProgressUpdateEvent {
  readonly storyId: string;
  readonly chapterId: string;
  readonly position: number;
  readonly cursor: ReadingCursorApi;
  readonly baseRevision: number;
  readonly deviceId: string;
  readonly clientEventId: string;
}

export interface ProgressAckEvent {
  readonly storyId: string;
  readonly clientEventId: string;
  readonly progress: ReadingHistoryApiItem;
}

export interface ProgressChangedEvent {
  readonly storyId: string;
  readonly sourceDeviceId: string;
  readonly progress: ReadingHistoryApiItem;
}

export interface ProgressConflictEvent {
  readonly storyId: string;
  readonly clientEventId: string;
  readonly actualRevision: number;
  readonly progress: ReadingHistoryApiItem | null;
}

export interface ReadingProgressServerEvents {
  'progress:ack': (event: ProgressAckEvent) => void;
  'progress:changed': (event: ProgressChangedEvent) => void;
  'progress:conflict': (event: ProgressConflictEvent) => void;
  'progress:error': (event: { readonly code: string }) => void;
}

export interface ReadingProgressClientEvents {
  'progress:update': (event: ProgressUpdateEvent) => void;
}
