export type ReaderAnalyticsEventType =
  | 'STORY_VIEW'
  | 'CHAPTER_VIEW'
  | 'READING_STARTED'
  | 'READING_PROGRESS'
  | 'READING_COMPLETED';

export interface ReaderAnalyticsEvent {
  readonly eventId: string;
  readonly type: ReaderAnalyticsEventType;
  readonly version: 1;
  readonly sessionId: string;
  readonly storyId: string;
  readonly chapterId?: string;
  readonly progressPercent?: number;
  readonly activeSeconds?: number;
  readonly occurredAt: string;
}

export interface ReaderAnalyticsPublicConfig {
  readonly enabled: boolean;
  readonly maxBatchSize: number;
  readonly completionThresholdPercent: number;
  readonly progressHeartbeatSeconds: number;
}
