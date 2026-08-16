import { validateEnvironment } from './environment.validation';

type EnvironmentInput = Record<string, unknown>;

describe('validateEnvironment', () => {
  const validBase: EnvironmentInput = {
    NODE_ENV: 'test',
    DATABASE_URL:
      'postgresql://postgres:postgres@localhost:5432/quan_ly_truyen_test',

    JWT_ACCESS_SECRET: 'test-access-secret-at-least-32-characters',

    JWT_REFRESH_SECRET: 'test-refresh-secret-that-is-different-and-long-enough',

    MAIL_MESSAGE_ID_DOMAIN: 'mail.example.test',
    MAIL_PAYLOAD_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
  };
  const productionBase: EnvironmentInput = {
    ...validBase,

    NODE_ENV: 'production',

    AUTH_ADMIN_MFA_ENABLED: 'true',

    AUTH_MFA_ENCRYPTION_KEY: Buffer.alloc(32, 8).toString('base64'),

    APP_PUBLIC_URL: 'https://api.example.com',

    FRONTEND_PUBLIC_URL: 'https://app.example.com',

    CORS_ALLOWED_ORIGINS: 'https://app.example.com',

    JWT_ACCESS_SECRET: 'production-access-value-1234567890-abcdef',

    JWT_REFRESH_SECRET: 'production-refresh-value-1234567890-abcdef',

    AUTH_CSRF_SECRET: 'production-csrf-value-1234567890-abcdef',

    AUTH_COOKIE_SECURE: 'true',

    AUTH_COOKIE_PATH: '/api/v1/auth',

    AUTH_CSRF_ENABLED: 'true',

    AUTH_CSRF_COOKIE_PATH: '/',

    AUTH_LOGIN_RATE_LIMIT_ENABLED: 'true',

    AUTH_JWT_BLACKLIST_ENABLED: 'true',

    AUTH_JWT_BLACKLIST_FAILURE_MODE: 'closed',

    REDIS_ENABLED: 'true',

    QUEUE_ENABLED: 'true',

    QUEUE_WORKER_HEARTBEAT_ENABLED: 'true',

    IDEMPOTENCY_FAILURE_MODE: 'closed',

    ALLOW_IN_MEMORY_INFRASTRUCTURE_FALLBACK: 'false',

    MAIL_ENABLED: 'true',

    SMTP_VERIFY_ON_STARTUP: 'true',

    MAIL_PAYLOAD_ALLOW_LEGACY_PLAINTEXT_READ: 'false',

    OBSERVABILITY_ENABLED: 'true',

    METRICS_ENABLED: 'true',

    METRICS_BEARER_TOKEN: 'production-metrics-value-1234567890-abcdef',

    SWAGGER_ENABLED: 'false',

    MAIL_MESSAGE_ID_DOMAIN: 'mail.example.com',

    MAIL_PAYLOAD_ENCRYPTION_KEY: Buffer.alloc(
      32,

      7,
    ).toString('base64'),
  };

  it('enforces production readiness configuration', () => {
    expect(() => validateEnvironment(productionBase)).not.toThrow();

    expect(() =>
      validateEnvironment({
        ...productionBase,
        AUTH_ADMIN_MFA_ENABLED: 'false',
      }),
    ).toThrow('AUTH_ADMIN_MFA_ENABLED must be true in production');

    expect(() =>
      validateEnvironment({
        ...productionBase,
        AUTH_MFA_ENCRYPTION_KEY: Buffer.alloc(16, 8).toString('base64'),
      }),
    ).toThrow('AUTH_MFA_ENCRYPTION_KEY');

    expect(() =>
      validateEnvironment({
        ...productionBase,

        MAIL_ENABLED: 'false',
      }),
    ).toThrow('MAIL_ENABLED must be true in production');

    expect(() =>
      validateEnvironment({
        ...productionBase,

        MAIL_PAYLOAD_ALLOW_LEGACY_PLAINTEXT_READ: 'true',
      }),
    ).toThrow(
      'MAIL_PAYLOAD_ALLOW_LEGACY_PLAINTEXT_READ must be false in production',
    );

    expect(() =>
      validateEnvironment({
        ...productionBase,

        CORS_ALLOWED_ORIGINS: 'http://localhost:4200',
      }),
    ).toThrow('CORS_ALLOWED_ORIGINS must use https:// in production');

    expect(() =>
      validateEnvironment({
        ...productionBase,

        IDEMPOTENCY_FAILURE_MODE: 'open',
      }),
    ).toThrow('IDEMPOTENCY_FAILURE_MODE must be closed in production');
  });

  it('rejects mail payload encryption keys that are not 32 bytes', () => {
    expect(() =>
      validateEnvironment({
        ...validBase,

        MAIL_PAYLOAD_ENCRYPTION_KEY: Buffer.alloc(16, 1).toString('base64'),
      }),
    ).toThrow(
      'MAIL_PAYLOAD_ENCRYPTION_KEY must be Base64 encoding of exactly 32 bytes',
    );
  });

  it('requires the idempotency processing lease to outlive the HTTP timeout', () => {
    expect(() =>
      validateEnvironment({
        ...validBase,
        HTTP_REQUEST_TIMEOUT_MS: '60000',
        IDEMPOTENCY_PROCESSING_LEASE_TTL_SECONDS: '60',
      }),
    ).toThrow(
      'IDEMPOTENCY_PROCESSING_LEASE_TTL_SECONDS must exceed HTTP_REQUEST_TIMEOUT_MS',
    );

    expect(() =>
      validateEnvironment({
        ...validBase,
        HTTP_REQUEST_TIMEOUT_MS: '60000',
        IDEMPOTENCY_PROCESSING_LEASE_TTL_SECONDS: '61',
      }),
    ).not.toThrow();
  });

  it('validates OAuth provider configuration and Redis dependency', () => {
    const googleOAuth: EnvironmentInput = {
      ...validBase,
      REDIS_ENABLED: 'true',
      AUTH_OAUTH_ENABLED: 'true',
      AUTH_OAUTH_GOOGLE_ENABLED: 'true',
      AUTH_OAUTH_GOOGLE_CLIENT_ID: 'google-client-id',
      AUTH_OAUTH_GOOGLE_CLIENT_SECRET: 'google-client-secret',
      AUTH_OAUTH_GOOGLE_CALLBACK_URL:
        'http://localhost:3000/api/v1/auth/oauth/google/callback',
    };

    expect(() => validateEnvironment(googleOAuth)).not.toThrow();
    expect(() =>
      validateEnvironment({ ...googleOAuth, REDIS_ENABLED: 'false' }),
    ).toThrow('REDIS_ENABLED must be true');
    expect(() =>
      validateEnvironment({
        ...googleOAuth,
        AUTH_OAUTH_GOOGLE_CLIENT_SECRET: undefined,
      }),
    ).toThrow('AUTH_OAUTH_GOOGLE_CLIENT_SECRET');
    expect(() =>
      validateEnvironment({
        ...googleOAuth,
        AUTH_OAUTH_STATE_COOKIE_NAME: 'refresh_token',
      }),
    ).toThrow('AUTH_OAUTH_STATE_COOKIE_NAME');
    expect(() =>
      validateEnvironment({
        ...productionBase,
        AUTH_OAUTH_ENABLED: 'true',
        AUTH_OAUTH_GOOGLE_ENABLED: 'true',
        AUTH_OAUTH_GOOGLE_CLIENT_ID: 'google-client-id',
        AUTH_OAUTH_GOOGLE_CLIENT_SECRET: 'google-client-secret',
        AUTH_OAUTH_GOOGLE_CALLBACK_URL:
          'http://api.example.com/api/v1/auth/oauth/google/callback',
      }),
    ).toThrow('AUTH_OAUTH_GOOGLE_CALLBACK_URL must use https://');
  });

  it('parses boolean and integer values correctly', () => {
    const result = validateEnvironment({
      ...validBase,
      PORT: '3100',
      MAINTENANCE_MODE: 'false',
    });

    expect(result.PORT).toBe(3100);
    expect(result.MAINTENANCE_MODE).toBe(false);
  });

  it('validates observability defaults and bounded metrics path', () => {
    const result = validateEnvironment(validBase);

    expect(result.OBSERVABILITY_ENABLED).toBe(true);
    expect(result.METRICS_ENABLED).toBe(true);
    expect(result.METRICS_PATH).toBe('/internal/metrics');
    expect(() =>
      validateEnvironment({ ...validBase, METRICS_PATH: '/metrics' }),
    ).toThrow('METRICS_PATH');
  });

  it('requires a long metrics token in production when metrics are enabled', () => {
    const productionBase: EnvironmentInput = {
      ...validBase,
      NODE_ENV: 'production',

      AUTH_ADMIN_MFA_ENABLED: 'true',

      AUTH_MFA_ENCRYPTION_KEY: Buffer.alloc(32, 8).toString('base64'),

      APP_PUBLIC_URL: 'https://api.example.com',

      FRONTEND_PUBLIC_URL: 'https://app.example.com',

      CORS_ALLOWED_ORIGINS: 'https://app.example.com',

      JWT_ACCESS_SECRET: 'production-access-value-1234567890-abcdef',

      JWT_REFRESH_SECRET: 'production-refresh-value-1234567890-abcdef',

      AUTH_CSRF_SECRET: 'production-csrf-value-1234567890-abcdef',

      AUTH_COOKIE_SECURE: 'true',

      AUTH_COOKIE_PATH: '/api/v1/auth',

      AUTH_CSRF_ENABLED: 'true',

      AUTH_CSRF_COOKIE_PATH: '/',

      AUTH_LOGIN_RATE_LIMIT_ENABLED: 'true',

      AUTH_JWT_BLACKLIST_ENABLED: 'true',

      AUTH_JWT_BLACKLIST_FAILURE_MODE: 'closed',

      REDIS_ENABLED: 'true',

      QUEUE_ENABLED: 'true',

      QUEUE_WORKER_HEARTBEAT_ENABLED: 'true',

      IDEMPOTENCY_FAILURE_MODE: 'closed',

      ALLOW_IN_MEMORY_INFRASTRUCTURE_FALLBACK: 'false',

      MAIL_ENABLED: 'true',

      SMTP_VERIFY_ON_STARTUP: 'true',

      MAIL_PAYLOAD_ALLOW_LEGACY_PLAINTEXT_READ: 'false',

      OBSERVABILITY_ENABLED: 'true',

      METRICS_ENABLED: 'true',

      METRICS_BEARER_TOKEN: 'production-metrics-value-1234567890-abcdef',

      SWAGGER_ENABLED: 'false',
    };

    expect(() =>
      validateEnvironment({
        ...productionBase,
        METRICS_BEARER_TOKEN: undefined,
      }),
    ).toThrow('METRICS_BEARER_TOKEN');
    expect(() =>
      validateEnvironment({
        ...productionBase,
        METRICS_BEARER_TOKEN: 'local-token-with-at-least-32-characters',
      }),
    ).not.toThrow();
  });

  it('validates mail queue retention bounds', () => {
    const result = validateEnvironment({
      ...validBase,

      MAIL_QUEUE_COMPLETED_RETENTION_SECONDS: '3600',

      MAIL_QUEUE_COMPLETED_RETENTION_COUNT: '100',

      MAIL_QUEUE_FAILED_RETENTION_SECONDS: '604800',

      MAIL_QUEUE_FAILED_RETENTION_COUNT: '1000',
    });

    expect(result.MAIL_QUEUE_COMPLETED_RETENTION_SECONDS).toBe(3600);

    expect(result.MAIL_QUEUE_FAILED_RETENTION_SECONDS).toBe(604_800);

    expect(() =>
      validateEnvironment({
        ...validBase,

        MAIL_QUEUE_COMPLETED_RETENTION_SECONDS: '59',
      }),
    ).toThrow('MAIL_QUEUE_COMPLETED_RETENTION_SECONDS');

    expect(() =>
      validateEnvironment({
        ...validBase,

        MAIL_QUEUE_COMPLETED_RETENTION_SECONDS: '7200',

        MAIL_QUEUE_FAILED_RETENTION_SECONDS: '3600',
      }),
    ).toThrow(
      'MAIL_QUEUE_FAILED_RETENTION_SECONDS must be greater than or equal to MAIL_QUEUE_COMPLETED_RETENTION_SECONDS',
    );
  });

  it('rejects missing DATABASE_URL', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'test',
        JWT_ACCESS_SECRET: validBase.JWT_ACCESS_SECRET,
      }),
    ).toThrow('DATABASE_URL');
  });

  it('requires JWT blacklist with closed failure mode in production', () => {
    const productionBase: EnvironmentInput = {
      ...validBase,

      NODE_ENV: 'production',

      AUTH_ADMIN_MFA_ENABLED: 'true',

      AUTH_MFA_ENCRYPTION_KEY: Buffer.alloc(32, 8).toString('base64'),

      APP_PUBLIC_URL: 'https://api.example.com',

      FRONTEND_PUBLIC_URL: 'https://app.example.com',

      CORS_ALLOWED_ORIGINS: 'https://app.example.com',

      JWT_ACCESS_SECRET: 'production-access-value-1234567890-abcdef',

      JWT_REFRESH_SECRET: 'production-refresh-value-1234567890-abcdef',

      AUTH_CSRF_SECRET: 'production-csrf-value-1234567890-abcdef',

      AUTH_COOKIE_SECURE: 'true',

      AUTH_COOKIE_PATH: '/api/v1/auth',

      AUTH_CSRF_ENABLED: 'true',

      AUTH_CSRF_COOKIE_PATH: '/',

      AUTH_LOGIN_RATE_LIMIT_ENABLED: 'true',

      REDIS_ENABLED: 'true',

      QUEUE_ENABLED: 'true',

      QUEUE_WORKER_HEARTBEAT_ENABLED: 'true',

      IDEMPOTENCY_FAILURE_MODE: 'closed',

      ALLOW_IN_MEMORY_INFRASTRUCTURE_FALLBACK: 'false',

      MAIL_ENABLED: 'true',

      SMTP_VERIFY_ON_STARTUP: 'true',

      MAIL_PAYLOAD_ALLOW_LEGACY_PLAINTEXT_READ: 'false',

      OBSERVABILITY_ENABLED: 'true',

      METRICS_ENABLED: 'true',

      METRICS_BEARER_TOKEN: 'production-metrics-value-1234567890-abcdef',

      SWAGGER_ENABLED: 'false',
    };

    expect(() =>
      validateEnvironment({
        ...productionBase,

        AUTH_JWT_BLACKLIST_ENABLED: 'false',

        AUTH_JWT_BLACKLIST_FAILURE_MODE: 'closed',
      }),
    ).toThrow('AUTH_JWT_BLACKLIST_ENABLED must be true in production');

    expect(() =>
      validateEnvironment({
        ...productionBase,

        AUTH_JWT_BLACKLIST_ENABLED: 'true',

        AUTH_JWT_BLACKLIST_FAILURE_MODE: 'open',
      }),
    ).toThrow('AUTH_JWT_BLACKLIST_FAILURE_MODE must be closed in production');

    expect(() =>
      validateEnvironment({
        ...productionBase,

        AUTH_JWT_BLACKLIST_ENABLED: 'true',

        AUTH_JWT_BLACKLIST_FAILURE_MODE: 'closed',
      }),
    ).not.toThrow();
  });
  it('rejects a missing access-token secret', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'test',
        DATABASE_URL: validBase.DATABASE_URL,
      }),
    ).toThrow('JWT_ACCESS_SECRET');
  });

  it('allows Cloudinary to remain disabled without credentials', () => {
    expect(() =>
      validateEnvironment({ ...validBase, CLOUDINARY_ENABLED: 'false' }),
    ).not.toThrow();
  });

  it('fails fast when Cloudinary is enabled without credentials and presets', () => {
    expect(() =>
      validateEnvironment({ ...validBase, CLOUDINARY_ENABLED: 'true' }),
    ).toThrow('CLOUDINARY_CLOUD_NAME');
  });

  it('rejects wildcard origin when credentials are true', () => {
    expect(() =>
      validateEnvironment({
        ...validBase,
        CORS_ALLOWED_ORIGINS: '*',
        CORS_CREDENTIALS: 'true',
      }),
    ).toThrow('CORS_ALLOWED_ORIGINS');
  });

  it('rejects default locale not present in supported locales', () => {
    expect(() =>
      validateEnvironment({
        ...validBase,
        DEFAULT_LOCALE: 'ja-JP',
        SUPPORTED_LOCALES: 'vi-VN,en-US',
      }),
    ).toThrow('DEFAULT_LOCALE');
  });

  it('requires SMTP username and password together', () => {
    expect(() =>
      validateEnvironment({
        ...validBase,
        MAIL_ENABLED: 'true',
        SMTP_USERNAME: 'mailer',
      }),
    ).toThrow('SMTP_USERNAME and SMTP_PASSWORD');
  });

  it('requires secure SMTP on port 465', () => {
    expect(() =>
      validateEnvironment({
        ...validBase,
        MAIL_ENABLED: 'true',
        SMTP_PORT: '465',
        SMTP_SECURE: 'false',
      }),
    ).toThrow('SMTP_SECURE');
  });

  it('requires a valid Message-ID domain when mail is enabled', () => {
    expect(() =>
      validateEnvironment({
        ...validBase,
        MAIL_ENABLED: 'true',
        MAIL_MESSAGE_ID_DOMAIN: 'not a domain',
      }),
    ).toThrow('MAIL_MESSAGE_ID_DOMAIN');

    expect(() =>
      validateEnvironment({
        ...validBase,
        MAIL_ENABLED: 'true',
        MAIL_MESSAGE_ID_DOMAIN: 'mail.example.com',
      }),
    ).not.toThrow();
  });

  it('accepts redis and rediss URLs but rejects other protocols', () => {
    expect(() =>
      validateEnvironment({
        ...validBase,
        REDIS_URL: 'rediss://user:pass@example.com:6380/2',
      }),
    ).not.toThrow();
    expect(() =>
      validateEnvironment({ ...validBase, REDIS_URL: 'http://example.com' }),
    ).toThrow('REDIS_URL protocol');
  });

  it('requires Redis when queues are enabled', () => {
    expect(() =>
      validateEnvironment({
        ...validBase,
        QUEUE_ENABLED: 'true',
        REDIS_ENABLED: 'false',
      }),
    ).toThrow('REDIS_ENABLED must be true when QUEUE_ENABLED=true');
  });

  it('allows queues, Redis and Redis-dependent auth features to be disabled outside production', () => {
    expect(() =>
      validateEnvironment({
        ...validBase,

        QUEUE_ENABLED: 'false',

        REDIS_ENABLED: 'false',

        AUTH_LOGIN_RATE_LIMIT_ENABLED: 'false',

        AUTH_JWT_BLACKLIST_ENABLED: 'false',

        AUTH_ACCESS_AUTHORIZATION_CACHE_ENABLED: 'false',
      }),
    ).not.toThrow();
  });
  it('requires Redis when the auth authorization cache is enabled', () => {
    expect(() =>
      validateEnvironment({
        ...validBase,

        REDIS_ENABLED: 'false',

        QUEUE_ENABLED: 'false',

        AUTH_LOGIN_RATE_LIMIT_ENABLED: 'false',

        AUTH_JWT_BLACKLIST_ENABLED: 'false',

        AUTH_ACCESS_AUTHORIZATION_CACHE_ENABLED: 'true',
      }),
    ).toThrow('auth authorization cache is enabled');
  });

  it('validates outbox and worker bounds', () => {
    expect(() =>
      validateEnvironment({ ...validBase, OUTBOX_BATCH_SIZE: '501' }),
    ).toThrow('OUTBOX_BATCH_SIZE');
    expect(() =>
      validateEnvironment({ ...validBase, WORKER_CONCURRENCY: '0' }),
    ).toThrow('WORKER_CONCURRENCY');
    expect(() =>
      validateEnvironment({
        ...validBase,
        OUTBOX_PROCESSING_TIMEOUT_MS: '9999',
      }),
    ).toThrow('OUTBOX_PROCESSING_TIMEOUT_MS');
  });

  it('requires queues in production', () => {
    expect(() =>
      validateEnvironment({
        ...validBase,
        NODE_ENV: 'production',

        AUTH_ADMIN_MFA_ENABLED: 'true',

        AUTH_MFA_ENCRYPTION_KEY: Buffer.alloc(32, 8).toString('base64'),
        AUTH_COOKIE_SECURE: 'true',
        AUTH_LOGIN_RATE_LIMIT_ENABLED: 'true',
        REDIS_ENABLED: 'true',
        QUEUE_ENABLED: 'false',
        SWAGGER_ENABLED: 'false',
        METRICS_ENABLED: 'false',
        AUTH_JWT_BLACKLIST_ENABLED: 'true',

        AUTH_JWT_BLACKLIST_FAILURE_MODE: 'closed',
        AUTH_CSRF_ENABLED: 'true',

        AUTH_CSRF_SECRET: 'production-csrf-secret-with-at-least-32-characters',
      }),
    ).toThrow('QUEUE_ENABLED must be true in production');
  });

  it('requires a CSRF secret when CSRF is enabled', () => {
    expect(() =>
      validateEnvironment({
        ...validBase,

        AUTH_CSRF_ENABLED: 'true',

        AUTH_CSRF_SECRET: undefined,
      }),
    ).toThrow('AUTH_CSRF_SECRET is required when AUTH_CSRF_ENABLED=true');
  });

  it('requires a distinct CSRF secret', () => {
    expect(() =>
      validateEnvironment({
        ...validBase,

        AUTH_CSRF_ENABLED: 'true',

        AUTH_CSRF_SECRET: validBase.JWT_ACCESS_SECRET,
      }),
    ).toThrow(
      'AUTH_CSRF_SECRET must be different from JWT_ACCESS_SECRET and JWT_REFRESH_SECRET',
    );
  });

  it('requires the CSRF cookie path to be root', () => {
    expect(() =>
      validateEnvironment({
        ...validBase,

        AUTH_CSRF_COOKIE_PATH: '/api/v1/auth',
      }),
    ).toThrow('AUTH_CSRF_COOKIE_PATH must be exactly "/"');
  });

  it('requires CSRF protection in production', () => {
    const productionBase: EnvironmentInput = {
      ...validBase,
      NODE_ENV: 'production',

      AUTH_ADMIN_MFA_ENABLED: 'true',

      AUTH_MFA_ENCRYPTION_KEY: Buffer.alloc(32, 8).toString('base64'),
      AUTH_COOKIE_SECURE: 'true',
      AUTH_LOGIN_RATE_LIMIT_ENABLED: 'true',
      REDIS_ENABLED: 'true',
      QUEUE_ENABLED: 'true',
      SWAGGER_ENABLED: 'false',
      METRICS_ENABLED: 'false',
      AUTH_JWT_BLACKLIST_ENABLED: 'true',
      AUTH_JWT_BLACKLIST_FAILURE_MODE: 'closed',
      AUTH_CSRF_SECRET: 'production-csrf-secret-with-at-least-32-characters',
    };

    expect(() =>
      validateEnvironment({
        ...productionBase,
        AUTH_CSRF_ENABLED: 'false',
      }),
    ).toThrow('AUTH_CSRF_ENABLED must be true in production');
  });

  it('forbids disabled Redis and in-memory fallback in production', () => {
    const productionBase: EnvironmentInput = {
      ...validBase,
      NODE_ENV: 'production',

      AUTH_ADMIN_MFA_ENABLED: 'true',

      AUTH_MFA_ENCRYPTION_KEY: Buffer.alloc(32, 8).toString('base64'),
      AUTH_COOKIE_SECURE: 'true',
      AUTH_LOGIN_RATE_LIMIT_ENABLED: 'true',
      QUEUE_ENABLED: 'true',
      SWAGGER_ENABLED: 'false',
      AUTH_JWT_BLACKLIST_ENABLED: 'true',
      AUTH_JWT_BLACKLIST_FAILURE_MODE: 'closed',
      AUTH_CSRF_ENABLED: 'true',

      AUTH_CSRF_SECRET: 'production-csrf-secret-with-at-least-32-characters',
    };
    expect(() =>
      validateEnvironment({ ...productionBase, REDIS_ENABLED: 'false' }),
    ).toThrow('REDIS_ENABLED must be true');
    expect(() =>
      validateEnvironment({
        ...productionBase,
        REDIS_ENABLED: 'true',
        ALLOW_IN_MEMORY_INFRASTRUCTURE_FALLBACK: 'true',
      }),
    ).toThrow('ALLOW_IN_MEMORY_INFRASTRUCTURE_FALLBACK');
  });
});
