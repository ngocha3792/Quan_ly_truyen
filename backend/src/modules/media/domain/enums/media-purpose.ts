export const MEDIA_PURPOSE_VALUES = [
  'AVATAR',
  'AUTHOR_BANNER',
  'STORY_COVER',
  'CHAPTER_IMAGE',
  'GENRE_COVER',
  'AUTHOR_APPLICATION_SAMPLE',
  'ATTACHMENT',
] as const;

export type MediaPurposeName = (typeof MEDIA_PURPOSE_VALUES)[number];
