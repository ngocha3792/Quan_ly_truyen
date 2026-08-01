import { validateEnvironment } from './environment.validation';

describe('validateEnvironment', () => {
  const validBase = {
    NODE_ENV: 'test',
    DATABASE_URL:
      'postgresql://postgres:postgres@localhost:5432/quan_ly_truyen_test',
    JWT_ACCESS_SECRET: 'test-access-secret-at-least-32-characters',
    MAIL_MESSAGE_ID_DOMAIN: 'mail.example.test',
  };

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
    const productionBase = {
      ...validBase,
      NODE_ENV: 'production',
      REDIS_ENABLED: 'true',
      SWAGGER_ENABLED: 'false',
    };

    expect(() => validateEnvironment(productionBase)).toThrow(
      'METRICS_BEARER_TOKEN',
    );
    expect(() =>
      validateEnvironment({
        ...productionBase,
        METRICS_BEARER_TOKEN: 'local-token-with-at-least-32-characters',
      }),
    ).not.toThrow();
  });

  it('rejects missing DATABASE_URL', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'test',
        JWT_ACCESS_SECRET: validBase.JWT_ACCESS_SECRET,
      }),
    ).toThrow('DATABASE_URL');
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

  it('allows both queues and Redis to be disabled outside production', () => {
    expect(() =>
      validateEnvironment({
        ...validBase,
        QUEUE_ENABLED: 'false',
        REDIS_ENABLED: 'false',
      }),
    ).not.toThrow();
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

  it('forbids disabled Redis and in-memory fallback in production', () => {
    const productionBase = {
      ...validBase,
      NODE_ENV: 'production',
      SWAGGER_ENABLED: 'false',
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
