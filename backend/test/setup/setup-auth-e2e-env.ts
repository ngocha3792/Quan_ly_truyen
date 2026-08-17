import 'dotenv/config';

const databaseUrl = process.env.TEST_DATABASE_URL;

const redisUrl = process.env.TEST_REDIS_URL;

if (!databaseUrl) {
  throw new Error('TEST_DATABASE_URL is required for Auth E2E');
}

if (!redisUrl) {
  throw new Error('TEST_REDIS_URL is required for Auth E2E');
}

assertTestDatabase(databaseUrl);

assertTestRedis(redisUrl);

process.env.NODE_ENV = 'test';

process.env.DATABASE_URL = databaseUrl;

process.env.REDIS_URL = redisUrl;

process.env.REDIS_ENABLED = 'true';

process.env.REDIS_KEY_PREFIX = `qlt:test:e2e:${process.pid}`;

process.env.QUEUE_ENABLED = 'false';

process.env.QUEUE_PREFIX = `qlt:test:e2e:${process.pid}`;

process.env.MAIL_ENABLED = 'false';

process.env.ANALYTICS_ENABLED = 'false';

process.env.FRONTEND_PUBLIC_URL = 'http://localhost:4200';

process.env.JWT_ACCESS_SECRET = 'e2e-access-secret-at-least-32-characters';

process.env.JWT_REFRESH_SECRET = 'e2e-refresh-secret-at-least-32-characters';

process.env.JWT_ISSUER = 'quan-ly-truyen-auth-e2e';

process.env.JWT_AUDIENCE = 'quan-ly-truyen-auth-e2e-client';

process.env.JWT_ACCESS_TTL_SECONDS = '900';

process.env.JWT_REFRESH_TTL_SECONDS = '2592000';

process.env.AUTH_REFRESH_COOKIE_NAME = 'refresh_token';

process.env.AUTH_COOKIE_SECURE = 'false';

process.env.AUTH_COOKIE_SAME_SITE = 'lax';

process.env.AUTH_COOKIE_PATH = '/api/v1/auth';

process.env.AUTH_LOGIN_RATE_LIMIT_ENABLED = 'true';

process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_SECONDS = '60';

process.env.AUTH_LOGIN_RATE_LIMIT_IP_LIMIT = '100';

process.env.AUTH_LOGIN_RATE_LIMIT_IDENTIFIER_LIMIT = '3';

process.env.AUTH_JWT_BLACKLIST_ENABLED = 'true';

process.env.AUTH_JWT_BLACKLIST_FAILURE_MODE = 'closed';

process.env.AUTH_MAX_ACTIVE_SESSIONS = '2';

process.env.AUTH_SESSION_LIST_LIMIT = '20';

process.env.AUTH_SECURITY_EVENT_HISTORY_LIMIT = '50';

process.env.AUTH_ADMIN_MFA_ENABLED = 'true';

process.env.AUTH_ADMIN_MFA_ISSUER = 'Quan Ly Truyen E2E';

process.env.AUTH_MFA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');

process.env.AUTH_MFA_PREAUTH_TTL_SECONDS = '300';

process.env.AUTH_MFA_MAX_VERIFICATION_ATTEMPTS = '5';

process.env.AUTH_MFA_TOTP_WINDOW = '1';

process.env.AUTH_MFA_RECOVERY_CODE_COUNT = '10';

process.env.AUTH_OAUTH_ENABLED = 'true';

process.env.AUTH_OAUTH_STATE_TTL_SECONDS = '600';

process.env.AUTH_OAUTH_STATE_COOKIE_NAME = 'oauth_state';

process.env.AUTH_OAUTH_GOOGLE_ENABLED = 'true';

process.env.AUTH_OAUTH_GOOGLE_CLIENT_ID = 'qlt-e2e-google-client';

process.env.AUTH_OAUTH_GOOGLE_CLIENT_SECRET = 'qlt-e2e-google-client-secret';

process.env.AUTH_OAUTH_GOOGLE_CALLBACK_URL =
  'http://localhost:3000/api/v1/auth/oauth/google/callback';

process.env.AUTH_OAUTH_GITHUB_ENABLED = 'false';

process.env.AUTH_CSRF_ENABLED = 'true';

process.env.AUTH_CSRF_SECRET = 'e2e-csrf-secret-at-least-32-characters';

process.env.AUTH_CSRF_COOKIE_NAME = 'csrf_token';

process.env.AUTH_CSRF_COOKIE_PATH = '/';

process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:4200';

process.env.CORS_CREDENTIALS = 'true';

process.env.MAIL_PAYLOAD_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString(
  'base64',
);

process.env.MAIL_PAYLOAD_ALLOW_LEGACY_PLAINTEXT_READ = 'false';

process.env.CLOUDINARY_ENABLED = 'false';

process.env.OBSERVABILITY_ENABLED = 'false';

process.env.METRICS_ENABLED = 'false';

process.env.SWAGGER_ENABLED = 'false';
process.env.AUTH_ACCESS_AUTHORIZATION_CACHE_ENABLED = 'true';

process.env.AUTH_ACCESS_AUTHORIZATION_CACHE_TTL_SECONDS = '5';

function assertTestDatabase(value: string): void {
  if (process.env.ALLOW_UNSAFE_TEST_DB !== 'true') {
    const url = new URL(value);

    const name = url.pathname.replace(/^\//u, '').toLowerCase();

    if (!/(^|[_-])test($|[_-])/u.test(name)) {
      throw new Error(`Refusing non-test database: ${name}`);
    }
  }
}

function assertTestRedis(value: string): void {
  if (process.env.ALLOW_UNSAFE_TEST_DB !== 'true') {
    const url = new URL(value);

    const databaseNumber = Number(url.pathname.replace(/^\//u, '') || '0');

    if (!Number.isSafeInteger(databaseNumber) || databaseNumber <= 0) {
      throw new Error(
        'TEST_REDIS_URL must select a dedicated Redis database greater than 0',
      );
    }
  }
}
