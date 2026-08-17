import 'dotenv/config';

const databaseUrl = process.env.TEST_DATABASE_URL;

if (!databaseUrl) {
  throw new Error('TEST_DATABASE_URL is required for E2E tests');
}

assertSafeTestDatabase(databaseUrl);

process.env.NODE_ENV = 'test';

/*
 * Mọi E2E đều phải chạy trên database test riêng.
 * Không dùng DATABASE_URL của development.
 */
process.env.DATABASE_URL = databaseUrl;

/*
 * Generic E2E không kiểm tra các chức năng phụ thuộc Redis.
 *
 * Auth E2E được chạy riêng bằng:
 * npm run test:auth:e2e
 */
process.env.REDIS_ENABLED = 'false';

process.env.QUEUE_ENABLED = 'false';

process.env.MAIL_ENABLED = 'false';

process.env.ANALYTICS_ENABLED = 'false';

process.env.JWT_ACCESS_SECRET = 'e2e-access-secret-at-least-32-characters';

process.env.JWT_REFRESH_SECRET =
  'different-refresh-secret-at-least-32-characters';

process.env.JWT_ISSUER = 'quan-ly-truyen-e2e';

process.env.JWT_AUDIENCE = 'quan-ly-truyen-e2e-client';

process.env.JWT_ACCESS_TTL_SECONDS = '900';

process.env.JWT_REFRESH_TTL_SECONDS = '2592000';

/*
 * Redis bị tắt nên các adapter Redis của Auth
 * cũng phải bị tắt trong generic E2E.
 */
process.env.AUTH_LOGIN_RATE_LIMIT_ENABLED = 'false';

process.env.AUTH_JWT_BLACKLIST_ENABLED = 'false';

process.env.AUTH_JWT_BLACKLIST_FAILURE_MODE = 'closed';

process.env.AUTH_ACCESS_AUTHORIZATION_CACHE_ENABLED = 'false';

process.env.AUTH_ADMIN_MFA_ENABLED = 'false';

process.env.AUTH_OAUTH_ENABLED = 'false';

process.env.AUTH_ACCESS_AUTHORIZATION_CACHE_TTL_SECONDS = '15';

process.env.AUTH_CSRF_ENABLED = 'false';

process.env.AUTH_COOKIE_SECURE = 'false';

process.env.AUTH_COOKIE_SAME_SITE = 'lax';

process.env.AUTH_REFRESH_COOKIE_NAME = 'refresh_token';

process.env.AUTH_COOKIE_PATH = '/api/v1/auth';

/*
 * Chỉ được dùng trong test.
 * Production vẫn phải sử dụng Redis và fail closed.
 */
process.env.ALLOW_IN_MEMORY_INFRASTRUCTURE_FALLBACK = 'true';

process.env.MAIL_PAYLOAD_ENCRYPTION_KEY = Buffer.alloc(32, 8).toString(
  'base64',
);

process.env.MAIL_PAYLOAD_ALLOW_LEGACY_PLAINTEXT_READ = 'false';

process.env.CLOUDINARY_ENABLED = 'true';

process.env.CLOUDINARY_CLOUD_NAME = 'e2e-cloud';

process.env.CLOUDINARY_API_KEY = 'e2e-public-key';

process.env.CLOUDINARY_API_SECRET = 'e2e-cloudinary-secret';

process.env.CLOUDINARY_AVATAR_UPLOAD_PRESET = 'avatar';

process.env.CLOUDINARY_AUTHOR_BANNER_UPLOAD_PRESET = 'banner';

process.env.CLOUDINARY_STORY_COVER_UPLOAD_PRESET = 'cover';

process.env.CLOUDINARY_CHAPTER_IMAGE_UPLOAD_PRESET = 'chapter';

process.env.CLOUDINARY_ATTACHMENT_UPLOAD_PRESET = 'attachment';

process.env.OBSERVABILITY_ENABLED = 'false';

process.env.METRICS_ENABLED = 'false';

process.env.SWAGGER_ENABLED = 'false';

function assertSafeTestDatabase(value: string): void {
  if (process.env.ALLOW_UNSAFE_TEST_DB === 'true') {
    return;
  }

  const url = new URL(value);

  const databaseName = url.pathname.replace(/^\//u, '').toLowerCase();

  if (!databaseName || !/(^|[_-])test($|[_-])/u.test(databaseName)) {
    throw new Error(
      `Refusing to use non-test database for E2E: ${databaseName || '<empty>'}`,
    );
  }
}
