import { validateEnvironment } from './environment.validation';

describe('validateEnvironment', () => {
  const validBase = {
    NODE_ENV: 'test',
    DATABASE_URL:
      'postgresql://postgres:postgres@localhost:5432/quan_ly_truyen_test',
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
    expect(() => validateEnvironment({ NODE_ENV: 'test' })).toThrow(
      'DATABASE_URL',
    );
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
});
