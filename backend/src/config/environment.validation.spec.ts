import { validateEnvironment } from './environment.validation';

describe('validateEnvironment', () => {
  const validBase = {
    NODE_ENV: 'test',
    DATABASE_URL:
      'postgresql://postgres:postgres@localhost:5432/quan_ly_truyen_test',
    JWT_ACCESS_SECRET: 'test-access-secret-at-least-32-characters',
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
});
