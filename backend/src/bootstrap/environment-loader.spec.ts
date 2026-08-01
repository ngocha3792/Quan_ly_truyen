describe('environment loader', () => {
  const originalEnvironment = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { NODE_ENV: 'development' };
  });

  afterAll(() => {
    process.env = originalEnvironment;
  });

  it('resolves environment files in priority order', async () => {
    const { resolveEnvFilePaths } = await import('@/config/environment-files');

    expect(resolveEnvFilePaths('test')).toEqual([
      '.env.test.local',
      '.env.test',
      '.env.local',
      '.env',
    ]);
  });

  it('loads the highest-priority value without overriding it later', async () => {
    const valuesByPath: Record<string, string> = {
      '.env.development.local': 'first',
      '.env.development': 'second',
      '.env.local': 'third',
      '.env': 'fourth',
    };
    const config = jest.fn(
      ({ path, override }: { path: string; override: boolean }) => {
        if (override || process.env.ENV_PRIORITY === undefined) {
          process.env.ENV_PRIORITY = valuesByPath[path];
        }
        return { parsed: {} };
      },
    );
    jest.doMock('dotenv', () => ({ config }));

    const { loadEnvironmentFiles } = await import('./environment-loader');
    loadEnvironmentFiles();

    expect(config.mock.calls.map(([options]) => options.path)).toEqual([
      '.env.development.local',
      '.env.development',
      '.env.local',
      '.env',
    ]);
    expect(config).toHaveBeenCalledWith(
      expect.objectContaining({ override: false }),
    );
    expect(process.env.ENV_PRIORITY).toBe('first');
  });

  it('does not override a value supplied by the runtime', async () => {
    process.env.RUNTIME_VALUE = 'runtime';
    const config = jest.fn(
      ({ override }: { path: string; override: boolean }) => {
        if (override || process.env.RUNTIME_VALUE === undefined) {
          process.env.RUNTIME_VALUE = 'file';
        }
        return { parsed: {} };
      },
    );
    jest.doMock('dotenv', () => ({ config }));

    const { loadEnvironmentFiles } = await import('./environment-loader');
    loadEnvironmentFiles();

    expect(process.env.RUNTIME_VALUE).toBe('runtime');
  });

  it('is idempotent when invoked repeatedly', async () => {
    const config = jest.fn().mockReturnValue({ parsed: {} });
    jest.doMock('dotenv', () => ({ config }));
    const { loadEnvironmentFiles } = await import('./environment-loader');

    loadEnvironmentFiles();
    loadEnvironmentFiles();

    expect(config).toHaveBeenCalledTimes(4);
  });

  it('does not read environment files in production', async () => {
    process.env.NODE_ENV = 'production';
    const config = jest.fn().mockReturnValue({ parsed: {} });
    jest.doMock('dotenv', () => ({ config }));
    const { loadEnvironmentFiles } = await import('./environment-loader');

    loadEnvironmentFiles();

    expect(config).not.toHaveBeenCalled();
  });
});
