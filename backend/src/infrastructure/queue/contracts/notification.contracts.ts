export const SEND_NOTIFICATION_JOB = 'notifications.send.v1';

export interface SendNotificationJobV1 {
  version: 1;
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  correlationId?: string;
}

export const AUTHOR_CHAPTER_PUBLISHED_NOTIFICATION_EVENT =
  'notification.author-chapter-published.v1';

export interface AuthorChapterPublishedNotificationV1 {
  readonly version: 1;
  readonly authorId: string;
  readonly storyId: string;
  readonly storySlug: string;
  readonly storyTitle: string;
  readonly chapterId: string;
  readonly chapterNumber: string;
  readonly chapterTitle: string;
  readonly publishedAt: string;
}
