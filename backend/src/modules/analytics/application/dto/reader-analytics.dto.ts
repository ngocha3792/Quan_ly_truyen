export type ReaderAnalyticsEventTypeName =
  | 'STORY_VIEW'
  | 'CHAPTER_VIEW'
  | 'READING_STARTED'
  | 'READING_PROGRESS'
  | 'READING_COMPLETED';
export interface ReaderAnalyticsEventInput {
  readonly eventId: string;
  readonly type: ReaderAnalyticsEventTypeName;
  readonly version: number;
  readonly sessionId: string;
  readonly storyId: string;
  readonly chapterId?: string;
  readonly progressPercent?: number;
  readonly activeSeconds?: number;
  readonly occurredAt: string;
}
export interface ReaderAnalyticsIngestionInput {
  readonly userId?: string;
  readonly anonymousReaderId?: string;
  readonly ipAddress?: string;
  readonly events: readonly ReaderAnalyticsEventInput[];
}
export interface ReaderAnalyticsIngestionResult {
  readonly accepted: number;
  readonly duplicates: number;
  readonly rejected: number;
  readonly disabled?: boolean;
}
