export const QUEUE_JOB_DEFAULTS = {
  ATTEMPTS: 3,
  BACKOFF_DELAY_MS: 5_000,
  REMOVE_ON_COMPLETE_COUNT: 1_000,
  REMOVE_ON_FAIL_COUNT: 5_000,
} as const;

export const QUEUE_BACKOFF_TYPES = {
  FIXED: 'fixed',
  EXPONENTIAL: 'exponential',
} as const;

export type QueueBackoffType =
  (typeof QUEUE_BACKOFF_TYPES)[keyof typeof QUEUE_BACKOFF_TYPES];
