import 'dotenv/config';

process.env.NODE_ENV = 'test';

process.env.DATABASE_URL ??=
  'postgresql://postgres:postgres@localhost:5432/quan_ly_truyen_test';

process.env.JWT_ACCESS_SECRET =
  'e2e-access-secret-at-least-32-characters';

process.env.JWT_REFRESH_SECRET =
  'different-refresh-secret-at-least-32-characters';

process.env.JWT_ISSUER =
  'quan-ly-truyen-e2e';

process.env.JWT_AUDIENCE =
  'quan-ly-truyen-e2e-client';

/*
 * Generic E2E suite cố ý không dùng Redis.
 */
process.env.REDIS_ENABLED =
  'false';

process.env.QUEUE_ENABLED =
  'false';

process.env.MAIL_ENABLED =
  'false';

/*
 * Không được kế thừa các giá trị true từ .env.
 *
 * Khi REDIS_ENABLED=false, ba tính năng này bắt buộc
 * phải bị tắt.
 */
process.env.AUTH_LOGIN_RATE_LIMIT_ENABLED =
  'false';

process.env.AUTH_JWT_BLACKLIST_ENABLED =
  'false';

process.env.AUTH_ACCESS_AUTHORIZATION_CACHE_ENABLED =
  'false';

process.env.AUTH_ACCESS_AUTHORIZATION_CACHE_TTL_SECONDS =
  '15';

/*
 * Chỉ dùng trong test. Production vẫn phải fail closed.
 */
process.env.ALLOW_IN_MEMORY_INFRASTRUCTURE_FALLBACK =
  'true';

process.env.CLOUDINARY_ENABLED =
  'true';

process.env.CLOUDINARY_CLOUD_NAME =
  'e2e-cloud';

process.env.CLOUDINARY_API_KEY =
  'e2e-public-key';

process.env.CLOUDINARY_API_SECRET =
  'e2e-cloudinary-secret';

process.env.CLOUDINARY_AVATAR_UPLOAD_PRESET =
  'avatar';

process.env.CLOUDINARY_AUTHOR_BANNER_UPLOAD_PRESET =
  'banner';

process.env.CLOUDINARY_STORY_COVER_UPLOAD_PRESET =
  'cover';

process.env.CLOUDINARY_CHAPTER_IMAGE_UPLOAD_PRESET =
  'chapter';

process.env.CLOUDINARY_ATTACHMENT_UPLOAD_PRESET =
  'attachment';