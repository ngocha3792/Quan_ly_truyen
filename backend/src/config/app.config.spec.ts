import appConfig from './app.config';

describe('appConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('builds typed application config from environment variables', () => {
    process.env.PORT = '4000';
    process.env.SUPPORTED_LOCALES = 'vi-VN,en-US';

    expect(appConfig()).toEqual(
      expect.objectContaining({
        port: 4000,
        supportedLocales: ['vi-VN', 'en-US'],
      }),
    );
  });
});
