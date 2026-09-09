export const QUEUE_NAMES = {
  MEDIA: 'media',
  MAIL: 'mail',
  NOTIFICATIONS: 'notifications',
  STORY_SCHEDULING: 'story-scheduling',
  ANALYTICS: 'analytics',
  OUTBOX: 'outbox',
  AI: 'ai',
  TTS: 'tts',
  SEARCH: 'search',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
