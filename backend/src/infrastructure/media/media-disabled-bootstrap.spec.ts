import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { configureApplication } from '@/bootstrap/application-configurator';
import type { AppConfig } from '@/config';
import { PrismaService } from '@/infrastructure/database/prisma';

describe('Cloudinary-disabled runtime bootstrap', () => {
  jest.setTimeout(30_000);

  const prisma = {
    inboundWebhookEvent: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    outboxEvent: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL =
      'postgresql://postgres:postgres@localhost:5432/bootstrap_test';
    process.env.JWT_ACCESS_SECRET =
      'bootstrap-access-secret-at-least-32-characters';
    process.env.CLOUDINARY_ENABLED = 'false';
    process.env.REDIS_ENABLED = 'false';
    process.env.QUEUE_ENABLED = 'false';
    process.env.MAIL_ENABLED = 'false';
  });

  it('boots AppModule and keeps the liveness route public', async () => {
    const { AppModule } = await import('@/app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    const app: INestApplication = moduleRef.createNestApplication({
      rawBody: true,
    });
    configureApplication(
      app,
      app.get(ConfigService).getOrThrow<AppConfig>('app'),
    );
    await app.init();
    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .get('/api/v1/health/live')
      .expect(200)
      .expect({ status: 'ok' });
    await app.close();
  });

  it('boots WorkerModule without Cloudinary credentials', async () => {
    const { WorkerModule } = await import('@/worker.module');
    const moduleRef = await Test.createTestingModule({
      imports: [WorkerModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    await moduleRef.init();
    await moduleRef.close();
  });
});
