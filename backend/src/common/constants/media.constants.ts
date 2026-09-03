import { APP_NAME } from './application.constants';

export const MEDIA_STORAGE_PROVIDERS = {
  CLOUDINARY: 'cloudinary',
} as const;

export const CLOUDINARY_DEFAULTS = {
  ROOT_FOLDER: APP_NAME,
  SIGNATURE_ALGORITHM: 'sha256',
  UPLOAD_INTENT_TTL_SECONDS: 300,
  READY_ORPHAN_GRACE_SECONDS: 3_600,
  WEBHOOK_SIGNATURE_TTL_SECONDS: 300,
  WEBHOOK_POLL_INTERVAL_MS: 1_000,
  WEBHOOK_BATCH_SIZE: 100,
  WEBHOOK_MAX_ATTEMPTS: 5,
  WEBHOOK_RETRY_BASE_MS: 5_000,
  DELETE_MAX_ATTEMPTS: 5,
  DELETE_RETRY_BASE_MS: 5_000,
} as const;

export const CLOUDINARY_UPLOAD_PRESET_DEFAULTS = {
  AVATAR: 'qlt_avatar_signed',
  AUTHOR_BANNER: 'qlt_author_banner_signed',
  STORY_COVER: 'qlt_story_cover_signed',
  CHAPTER_IMAGE: 'qlt_chapter_image_signed',
  ATTACHMENT: 'qlt_attachment_signed',
} as const;
