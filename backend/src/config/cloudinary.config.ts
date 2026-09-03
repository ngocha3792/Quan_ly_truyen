import { registerAs } from '@nestjs/config';
import {
  CLOUDINARY_DEFAULTS,
  CLOUDINARY_UPLOAD_PRESET_DEFAULTS,
} from '@/common/constants';

function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer, received: ${value}`);
  }

  return parsed;
}

export default registerAs('cloudinary', () => ({
  enabled: process.env.CLOUDINARY_ENABLED === 'true',

  cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  apiKey: process.env.CLOUDINARY_API_KEY,
  apiSecret: process.env.CLOUDINARY_API_SECRET,

  rootFolder:
    process.env.CLOUDINARY_ROOT_FOLDER ?? CLOUDINARY_DEFAULTS.ROOT_FOLDER,

  signatureAlgorithm:
    process.env.CLOUDINARY_SIGNATURE_ALGORITHM ??
    CLOUDINARY_DEFAULTS.SIGNATURE_ALGORITHM,

  uploadIntentTtlSeconds: parsePositiveInteger(
    process.env.CLOUDINARY_UPLOAD_INTENT_TTL_SECONDS,
    CLOUDINARY_DEFAULTS.UPLOAD_INTENT_TTL_SECONDS,
  ),

  /**
   * READY không đồng nghĩa asset đã được domain attach.
   *
   * Flow thường là:
   *
   * confirm upload
   * -> READY
   * -> PATCH profile / submit application
   *
   * Cleanup chỉ được xóa READY orphan sau grace period này.
   */
  readyOrphanGraceSeconds: parsePositiveInteger(
    process.env.CLOUDINARY_READY_ORPHAN_GRACE_SECONDS,
    CLOUDINARY_DEFAULTS.READY_ORPHAN_GRACE_SECONDS,
  ),

  webhookSignatureTtlSeconds: parsePositiveInteger(
    process.env.CLOUDINARY_WEBHOOK_SIGNATURE_TTL_SECONDS,
    CLOUDINARY_DEFAULTS.WEBHOOK_SIGNATURE_TTL_SECONDS,
  ),

  webhookPollIntervalMs: parsePositiveInteger(
    process.env.CLOUDINARY_WEBHOOK_POLL_INTERVAL_MS,
    CLOUDINARY_DEFAULTS.WEBHOOK_POLL_INTERVAL_MS,
  ),
  webhookBatchSize: parsePositiveInteger(
    process.env.CLOUDINARY_WEBHOOK_BATCH_SIZE,
    CLOUDINARY_DEFAULTS.WEBHOOK_BATCH_SIZE,
  ),
  webhookMaxAttempts: parsePositiveInteger(
    process.env.CLOUDINARY_WEBHOOK_MAX_ATTEMPTS,
    CLOUDINARY_DEFAULTS.WEBHOOK_MAX_ATTEMPTS,
  ),
  webhookRetryBaseMs: parsePositiveInteger(
    process.env.CLOUDINARY_WEBHOOK_RETRY_BASE_MS,
    CLOUDINARY_DEFAULTS.WEBHOOK_RETRY_BASE_MS,
  ),
  deleteMaxAttempts: parsePositiveInteger(
    process.env.CLOUDINARY_DELETE_MAX_ATTEMPTS,
    CLOUDINARY_DEFAULTS.DELETE_MAX_ATTEMPTS,
  ),
  deleteRetryBaseMs: parsePositiveInteger(
    process.env.CLOUDINARY_DELETE_RETRY_BASE_MS,
    CLOUDINARY_DEFAULTS.DELETE_RETRY_BASE_MS,
  ),

  uploadPresets: {
    avatar:
      process.env.CLOUDINARY_AVATAR_UPLOAD_PRESET ??
      CLOUDINARY_UPLOAD_PRESET_DEFAULTS.AVATAR,
    authorBanner:
      process.env.CLOUDINARY_AUTHOR_BANNER_UPLOAD_PRESET ??
      CLOUDINARY_UPLOAD_PRESET_DEFAULTS.AUTHOR_BANNER,
    storyCover:
      process.env.CLOUDINARY_STORY_COVER_UPLOAD_PRESET ??
      CLOUDINARY_UPLOAD_PRESET_DEFAULTS.STORY_COVER,
    chapterImage:
      process.env.CLOUDINARY_CHAPTER_IMAGE_UPLOAD_PRESET ??
      CLOUDINARY_UPLOAD_PRESET_DEFAULTS.CHAPTER_IMAGE,
    attachment:
      process.env.CLOUDINARY_ATTACHMENT_UPLOAD_PRESET ??
      CLOUDINARY_UPLOAD_PRESET_DEFAULTS.ATTACHMENT,
  },
}));
