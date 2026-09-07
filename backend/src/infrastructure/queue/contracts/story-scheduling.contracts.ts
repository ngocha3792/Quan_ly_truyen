export const PUBLISH_SCHEDULED_CHAPTERS_JOB =
  'story-scheduling.publish-due-chapters.v1';

export interface PublishScheduledChaptersJobV1 {
  readonly version: 1;
  readonly batchSize: number;
}
