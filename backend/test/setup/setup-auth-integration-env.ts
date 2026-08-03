import 'dotenv/config';

const databaseUrl = process.env.TEST_DATABASE_URL;

const redisUrl = process.env.TEST_REDIS_URL;

if (!databaseUrl) {
  throw new Error('TEST_DATABASE_URL is required for Auth integration tests');
}

if (!redisUrl) {
  throw new Error('TEST_REDIS_URL is required for Auth integration tests');
}

assertSafeTestDatabase(databaseUrl);

assertSafeTestRedis(redisUrl);

process.env.NODE_ENV = 'test';

process.env.DATABASE_URL = databaseUrl;

process.env.REDIS_URL = redisUrl;

process.env.REDIS_ENABLED = 'true';

process.env.REDIS_KEY_PREFIX = `qlt:test:integration:${process.pid}`;

process.env.QUEUE_ENABLED = 'false';

process.env.QUEUE_PREFIX = `qlt:test:integration:${process.pid}`;

process.env.MAIL_ENABLED = 'false';

process.env.FRONTEND_PUBLIC_URL = 'http://localhost:4200';

process.env.JWT_ACCESS_SECRET =
  'integration-access-secret-at-least-32-characters';

process.env.JWT_REFRESH_SECRET =
  'integration-refresh-secret-at-least-32-characters';

process.env.JWT_ISSUER = 'quan-ly-truyen-integration';

process.env.JWT_AUDIENCE = 'quan-ly-truyen-integration-client';

process.env.AUTH_LOGIN_RATE_LIMIT_ENABLED = 'true';

process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_SECONDS = '60';

process.env.AUTH_LOGIN_RATE_LIMIT_IP_LIMIT = '100';

process.env.AUTH_LOGIN_RATE_LIMIT_IDENTIFIER_LIMIT = '3';

process.env.AUTH_JWT_BLACKLIST_ENABLED = 'true';

process.env.AUTH_JWT_BLACKLIST_FAILURE_MODE = 'closed';

process.env.AUTH_CSRF_ENABLED = 'true';

process.env.AUTH_CSRF_SECRET = 'integration-csrf-secret-at-least-32-characters';

process.env.AUTH_CSRF_COOKIE_NAME = 'csrf_token';

process.env.AUTH_CSRF_COOKIE_PATH = '/';

process.env.MAIL_PAYLOAD_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString(
  'base64',
);

process.env.MAIL_PAYLOAD_ALLOW_LEGACY_PLAINTEXT_READ = 'false';

process.env.CLOUDINARY_ENABLED = 'false';

process.env.OBSERVABILITY_ENABLED = 'false';

process.env.METRICS_ENABLED = 'false';

function assertSafeTestDatabase(value: string): void {
  if (process.env.ALLOW_UNSAFE_TEST_DB === 'false') {
    const url = new URL(value);

    const databaseName = url.pathname.replace(/^\//u, '').toLowerCase();

    if (!databaseName || !/(^|[_-])test($|[_-])/u.test(databaseName)) {
      throw new Error(
        `Refusing to use non-test database: ${databaseName || '<empty>'}`,
      );
    }
  }
}

function assertSafeTestRedis(value: string): void {
  if (process.env.ALLOW_UNSAFE_TEST_DB === 'false') {
    const url = new URL(value);

    const databaseNumber = Number(url.pathname.replace(/^\//u, '') || '0');

    if (!Number.isSafeInteger(databaseNumber) || databaseNumber <= 0) {
      throw new Error(
        'TEST_REDIS_URL must use a dedicated Redis database greater than 0',
      );
    }
  }
}
