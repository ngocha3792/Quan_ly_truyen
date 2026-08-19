export const STORY_SUBMISSION_STATUS_VALUES = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELED',
] as const;

export type StorySubmissionStatusName =
  (typeof STORY_SUBMISSION_STATUS_VALUES)[number];
