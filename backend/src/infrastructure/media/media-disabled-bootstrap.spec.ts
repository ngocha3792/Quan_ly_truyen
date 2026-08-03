import type { INestApplication } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { Test } from '@nestjs/testing';

import request from 'supertest';

import { configureApplication } from '@/bootstrap/application-configurator';

import type { AppConfig } from '@/config';

import { PrismaService } from '@/infrastructure/database/prisma';

describe('Cloudinary-disabled runtime bootstrap', () => {
  jest.setTimeout(30_000);

  const controlledEnvironmentKeys = [
    'NODE_ENV',
    'DATABASE_URL',

    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',

    'CLOUDINARY_ENABLED',

    'REDIS_ENABLED',
    'QUEUE_ENABLED',
    'MAIL_ENABLED',

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

  const prisma = {
    inboundWebhookEvent: {
      updateMany: jest
        .fn()
        .mockResolvedValue({
          count: 0,
        }),

      findMany: jest
        .fn()
        .mockResolvedValue([]),
    },

    outboxEvent: {
      updateMany: jest
        .fn()
        .mockResolvedValue({
          count: 0,
        }),

      findMany: jest
        .fn()
        .mockResolvedValue([]),
    },
  };

  beforeAll(() => {
    /*
     * Lưu lại môi trường thật để test không làm rò cấu hình
     * sang các suite chạy sau trong cùng Jest worker.
     */
    for (const key of controlledEnvironmentKeys) {
      originalEnvironment.set(
        key,

        process.env[key],
      );
    }

    Object.assign(process.env, {
      NODE_ENV: 'test',

      DATABASE_URL:
        'postgresql://postgres:postgres@localhost:5432/bootstrap_test',

      JWT_ACCESS_SECRET:
        'bootstrap-access-secret-at-least-32-characters',

      JWT_REFRESH_SECRET:
        'different-refresh-secret-at-least-32-characters',

      CLOUDINARY_ENABLED: 'false',

      REDIS_ENABLED: 'false',

      QUEUE_ENABLED: 'false',

      MAIL_ENABLED: 'false',

      /*
       * Test này cố ý boot ứng dụng khi Redis bị tắt.
       *
       * Vì vậy tất cả tính năng bắt buộc Redis cũng phải được
       * tắt rõ ràng, không được kế thừa giá trị true từ .env.
       */
      AUTH_LOGIN_RATE_LIMIT_ENABLED:
        'false',

      AUTH_JWT_BLACKLIST_ENABLED:
        'false',

      AUTH_ACCESS_AUTHORIZATION_CACHE_ENABLED:
        'false',

      AUTH_ACCESS_AUTHORIZATION_CACHE_TTL_SECONDS:
        '15',

      /*
       * Test environment được phép dùng adapter fallback
       * để xác nhận AppModule vẫn boot khi Redis bị tắt.
       */
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

  it('boots AppModule and keeps the liveness route public', async () => {
    /*
     * Import động sau khi test environment đã được thiết lập.
     *
     * Không chuyển import AppModule lên đầu file.
     */
    const { AppModule } =
      await import('@/app.module');

    const moduleRef =
      await Test.createTestingModule({
        imports: [AppModule],
      })
        .overrideProvider(PrismaService)
        .useValue(prisma)
        .compile();

    const app: INestApplication =
      moduleRef.createNestApplication({
        rawBody: true,
      });

    configureApplication(
      app,

      app
        .get(ConfigService)
        .getOrThrow<AppConfig>('app'),
    );

    await app.init();

    await request(
      app.getHttpServer() as Parameters<
        typeof request
      >[0],
    )
      .get('/api/v1/health/live')
      .expect(200)
      .expect({
        status: 'ok',
      });

    await app.close();
  });

  it('boots WorkerModule without Cloudinary credentials', async () => {
    /*
     * Import động để ConfigModule đọc đúng biến test
     * đã được override trong beforeAll.
     */
    const { WorkerModule } =
      await import('@/worker.module');

    const moduleRef =
      await Test.createTestingModule({
        imports: [WorkerModule],
      })
        .overrideProvider(PrismaService)
        .useValue(prisma)
        .compile();

    await moduleRef.init();

    await moduleRef.close();
  });
});