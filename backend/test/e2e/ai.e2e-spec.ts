import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '@/app.module';
import { configureApplication } from '@/bootstrap';
import { PermissionCode } from '@/common/enums';
import { hashPassword } from '@/common/utils';
import type { AppConfig } from '@/config';
import { PrismaService } from '@/infrastructure/database';

describe('AI policy/profile HTTP E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const runId = randomUUID();
  const password = 'StrongPass123!';
  const roleCode = `AI_E2E_${runId}`;
  let userId = '';
  let accessToken = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    configureApplication(
      app,
      app.get(ConfigService).getOrThrow<AppConfig>('app'),
    );
    await app.init();
    prisma = app.get(PrismaService);

    const permission = await prisma.permission.upsert({
      where: { code: PermissionCode.AI_CHAT_USE },
      update: {},
      create: {
        code: PermissionCode.AI_CHAT_USE,
        name: 'Use AI chat',
        resource: 'ai-chat',
        action: 'use',
      },
      select: { id: true },
    });
    const role = await prisma.role.create({
      data: {
        code: roleCode,
        name: 'AI E2E role',
        permissions: { create: { permissionId: permission.id } },
      },
      select: { id: true },
    });
    const user = await prisma.user.create({
      data: {
        email: `ai.e2e.${runId}@example.test`,
        username: `ai_e2e_${runId.replaceAll('-', '').slice(0, 16)}`,
        passwordHash: await hashPassword(password, { rounds: 10 }),
        displayName: 'AI E2E User',
        emailVerifiedAt: new Date(),
        userRoles: { create: { roleId: role.id } },
      },
      select: { id: true, email: true },
    });
    userId = user.id;

    const login = await request(httpServer())
      .post('/api/v1/auth/login')
      .send({
        identifier: user.email,
        password,
        deviceId: randomUUID(),
        deviceName: 'AI E2E',
      })
      .expect(200);
    accessToken = unwrap<{ accessToken: string }>(
      login.body as unknown,
    ).accessToken;
  });

  afterAll(async () => {
    if (userId) await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.role.deleteMany({ where: { code: roleCode } });
    await app.close();
  });

  it('default NONE và chỉ đổi sang SYSTEM khi user PATCH rõ ràng', async () => {
    const initial = await request(httpServer())
      .get('/api/v1/ai/policy')
      .set('Authorization', authorization())
      .expect(200);
    expect(
      unwrap<Record<string, unknown>>(initial.body as unknown),
    ).toMatchObject({
      rateLimitTier: 'FREE',
      fallbackPolicy: 'NONE',
    });

    const updated = await request(httpServer())
      .patch('/api/v1/ai/policy')
      .set('Authorization', authorization())
      .send({ fallbackPolicy: 'SYSTEM' })
      .expect(200);
    expect(
      unwrap<Record<string, unknown>>(updated.body as unknown),
    ).toMatchObject({
      fallbackPolicy: 'SYSTEM',
    });
  });

  it('lưu và đọc lại user AI profile qua HTTP', async () => {
    const updated = await request(httpServer())
      .patch('/api/v1/ai/profile')
      .set('Authorization', authorization())
      .send({
        model: 'profile-model',
        systemPrompt: 'concise-style',
        defaultTranslationLanguageCode: 'ja',
        autoTranslateOnPublish: true,
      })
      .expect(200);
    expect(
      unwrap<Record<string, unknown>>(updated.body as unknown),
    ).toMatchObject({
      scope: 'USER',
      model: 'profile-model',
      systemPrompt: 'concise-style',
      defaultTranslationLanguageCode: 'ja',
      autoTranslateOnPublish: true,
    });

    const fresh = await request(httpServer())
      .get('/api/v1/ai/profile')
      .set('Authorization', authorization())
      .expect(200);
    expect(
      unwrap<Record<string, unknown>>(fresh.body as unknown),
    ).toMatchObject({
      model: 'profile-model',
      defaultTranslationLanguageCode: 'ja',
      autoTranslateOnPublish: true,
    });
  });

  it('trả usage summary và quota chỉ cho user hiện tại', async () => {
    const response = await request(httpServer())
      .get('/api/v1/ai/usage')
      .set('Authorization', authorization())
      .expect(200);

    expect(
      unwrap<Record<string, unknown>>(response.body as unknown),
    ).toMatchObject({
      range: { timeZone: 'UTC' },
      totals: {
        requests: 0,
        inputTokens: 0,
        outputTokens: 0,
        errorRate: 0,
      },
      quota: { tier: 'FREE' },
      pricing: { status: 'NOT_CONFIGURED', estimatedCost: null },
    });
  });

  it('chặn custom AI Base URL trỏ vào private network trước khi persist', async () => {
    await request(httpServer())
      .post('/api/v1/ai/connections')
      .set('Authorization', authorization())
      .send({
        name: 'Blocked internal gateway',
        provider: 'CUSTOM',
        apiKey: 'not-sent-anywhere',
        baseUrl: 'https://127.0.0.1/v1',
        defaultModel: 'internal-model',
        protocol: 'OPENAI_CHAT_COMPLETIONS',
        authType: 'BEARER',
      })
      .expect(422);

    await expect(
      prisma.aiConnection.count({
        where: { userId, name: 'Blocked internal gateway' },
      }),
    ).resolves.toBe(0);
  });

  function authorization(): string {
    return `Bearer ${accessToken}`;
  }

  function httpServer() {
    return app.getHttpServer() as Parameters<typeof request>[0];
  }
});

function unwrap<T>(body: unknown): T {
  if (!body || typeof body !== 'object' || !('data' in body)) {
    throw new Error('Expected API success envelope');
  }
  return (body as { data: T }).data;
}
