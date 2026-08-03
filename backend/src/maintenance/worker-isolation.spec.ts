import { MODULE_METADATA } from '@nestjs/common/constants';

describe('maintenance worker isolation', () => {
  const controlledEnvironmentKeys = [
    'NODE_ENV',
    'DATABASE_URL',

    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',

    'CLOUDINARY_ENABLED',

    'MAIL_ENABLED',

    'REDIS_ENABLED',
    'QUEUE_ENABLED',

    'AUTH_LOGIN_RATE_LIMIT_ENABLED',
    'AUTH_JWT_BLACKLIST_ENABLED',

    'AUTH_ACCESS_AUTHORIZATION_CACHE_ENABLED',
    'AUTH_ACCESS_AUTHORIZATION_CACHE_TTL_SECONDS',

    'ALLOW_IN_MEMORY_INFRASTRUCTURE_FALLBACK',
  ] as const;

  const originalEnvironment = new Map<
    string,
    string | undefined
  >();

  beforeAll(() => {
    for (const key of controlledEnvironmentKeys) {
      originalEnvironment.set(
        key,

        process.env[key],
      );
    }

    Object.assign(process.env, {
      NODE_ENV: 'test',

      DATABASE_URL:
        'postgresql://postgres:postgres@localhost:5432/worker_isolation_test',

      JWT_ACCESS_SECRET:
        'worker-isolation-test-secret-at-least-32-characters',

      JWT_REFRESH_SECRET:
        'different-refresh-secret-at-least-32-characters',

      CLOUDINARY_ENABLED: 'false',

      MAIL_ENABLED: 'false',

      REDIS_ENABLED: 'false',

      QUEUE_ENABLED: 'false',

      /*
       * REDIS_ENABLED=false chỉ hợp lệ khi tất cả chức năng
       * bắt buộc Redis cũng được tắt.
       */
      AUTH_LOGIN_RATE_LIMIT_ENABLED:
        'false',

      AUTH_JWT_BLACKLIST_ENABLED:
        'false',

      AUTH_ACCESS_AUTHORIZATION_CACHE_ENABLED:
        'false',

      AUTH_ACCESS_AUTHORIZATION_CACHE_TTL_SECONDS:
        '15',

      ALLOW_IN_MEMORY_INFRASTRUCTURE_FALLBACK:
        'true',
    });
  });

  afterAll(() => {
    for (const key of controlledEnvironmentKeys) {
      const originalValue =
        originalEnvironment.get(key);

      if (originalValue === undefined) {
        delete process.env[key];

        continue;
      }

      process.env[key] = originalValue;
    }
  });

  it('keeps one-shot command modules isolated from long-running workers', async () => {
    const {
      MediaCleanupCommandModule,
    } = await import(
      './media-cleanup-command.module'
    );

    const {
      CloudinaryWebhookCommandModule,
    } = await import(
      './cloudinary-webhook-command.module'
    );

    const {
      OutboxRetentionCommandModule,
    } = await import(
      './outbox-retention-command.module'
    );

    for (const commandModule of [
      MediaCleanupCommandModule,

      CloudinaryWebhookCommandModule,

      OutboxRetentionCommandModule,
    ]) {
      const imports =
        (
          Reflect.getMetadata(
            MODULE_METADATA.IMPORTS,

            commandModule,
          ) as unknown[] | undefined
        ) ?? [];

      const importNames = imports.map(
        (value) =>
          typeof value === 'function'
            ? value.name
            : String(value),
      );

      expect(importNames).not.toEqual(
        expect.arrayContaining([
          'WorkerModule',

          'MailModule',

          'OutboxModule',
        ]),
      );
    }
  });
});