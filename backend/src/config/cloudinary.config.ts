import { registerAs } from '@nestjs/config';

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

  rootFolder: process.env.CLOUDINARY_ROOT_FOLDER ?? 'quan-ly-truyen',

  signatureAlgorithm: process.env.CLOUDINARY_SIGNATURE_ALGORITHM ?? 'sha256',

  uploadIntentTtlSeconds: parsePositiveInteger(
    process.env.CLOUDINARY_UPLOAD_INTENT_TTL_SECONDS,
    300,
  ),

  webhookSignatureTtlSeconds: parsePositiveInteger(
    process.env.CLOUDINARY_WEBHOOK_SIGNATURE_TTL_SECONDS,
    300,
  ),

  uploadPresets: {
    avatar: process.env.CLOUDINARY_AVATAR_UPLOAD_PRESET,
    authorBanner: process.env.CLOUDINARY_AUTHOR_BANNER_UPLOAD_PRESET,
    storyCover: process.env.CLOUDINARY_STORY_COVER_UPLOAD_PRESET,
    chapterImage: process.env.CLOUDINARY_CHAPTER_IMAGE_UPLOAD_PRESET,
    attachment: process.env.CLOUDINARY_ATTACHMENT_UPLOAD_PRESET,
  },
}));
