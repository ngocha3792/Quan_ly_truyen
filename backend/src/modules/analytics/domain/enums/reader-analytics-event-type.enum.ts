export const READER_ANALYTICS_EVENT_TYPE_VALUES = [
  'STORY_VIEW',
  'CHAPTER_VIEW',
  'READING_STARTED',
  'READING_PROGRESS',
  'READING_COMPLETED',
] as const;

export type ReaderAnalyticsEventTypeName =
  (typeof READER_ANALYTICS_EVENT_TYPE_VALUES)[number];
