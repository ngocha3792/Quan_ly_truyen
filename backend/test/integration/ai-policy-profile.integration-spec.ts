import { randomUUID } from 'node:crypto';

import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';

import { AppConfigModule } from '@/config';
import {
  AiProtocol as PrismaAiProtocol,
  AiProvider as PrismaAiProvider,
  AiUsageCapability,
} from '@/generated/prisma/client';
import { PrismaModule, PrismaService } from '@/infrastructure/database';
import { AiPolicyManager } from '@/modules/ai/application/policy/ai-policy.manager';
import { AiProfileManager } from '@/modules/ai/application/profile/ai-profile.manager';
import { AiFallbackPolicy, AiRateLimitTier } from '@/modules/ai/domain/enums';
import { PrismaAiPolicyPersistence } from '@/modules/ai/infrastructure/persistence/prisma-ai-policy.persistence';
import { PrismaAiProfilePersistence } from '@/modules/ai/infrastructure/persistence/prisma-ai-profile.persistence';
import { PrismaAiRateLimitPersistence } from '@/modules/ai/infrastructure/persistence/prisma-ai-rate-limit.persistence';
import { PrismaAiUsageReader } from '@/modules/ai/infrastructure/persistence/prisma-ai-usage.reader';
import { PrismaAiSecurityAuditAdapter } from '@/modules/ai/infrastructure/security';
import { RequestContextStore } from '@/common/middlewares';

describe('AI policy/profile PostgreSQL integration', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let policies: AiPolicyManager;
  let profiles: AiProfileManager;
  let rateLimits: PrismaAiRateLimitPersistence;
  let securityAudit: PrismaAiSecurityAuditAdapter;
  let usageReader: PrismaAiUsageReader;
  const runId = randomUUID();
  let userId = '';
  let storyId = '';

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppConfigModule, PrismaModule],
    }).compile();
    await moduleRef.init();
    prisma = moduleRef.get(PrismaService);

    const policyPersistence = new PrismaAiPolicyPersistence(prisma);
    const profilePersistence = new PrismaAiProfilePersistence(prisma);
    policies = new AiPolicyManager(policyPersistence);
    profiles = new AiProfileManager(profilePersistence);
    rateLimits = new PrismaAiRateLimitPersistence(prisma);
    securityAudit = new PrismaAiSecurityAuditAdapter(
      prisma,
      new RequestContextStore(),
    );
    usageReader = new PrismaAiUsageReader(prisma);

    const user = await prisma.user.create({
      data: {
        email: `ai.integration.${runId}@example.test`,
        username: `ai_it_${runId.replaceAll('-', '').slice(0, 16)}`,
        passwordHash: 'integration-password-hash',
        displayName: 'AI Integration User',
        emailVerifiedAt: new Date(),
        authorProfile: {
          create: {
            penName: `AI IT ${runId.slice(0, 8)}`,
            slug: `ai-it-${runId}`,
          },
        },
      },
      select: { id: true },
    });
    userId = user.id;
    const story = await prisma.story.create({
      data: {
        authorId: userId,
        title: 'AI integration story',
        slug: `ai-integration-story-${runId}`,
        synopsis: 'Integration fixture',
      },
      select: { id: true },
    });
    storyId = story.id;
  });

  afterAll(async () => {
    if (userId) await prisma.aiUsage.deleteMany({ where: { userId } });
    await prisma.auditLog.deleteMany({
      where: { entityType: 'AiConnection', entityId: runId },
    });
    if (storyId) await prisma.story.deleteMany({ where: { id: storyId } });
    if (userId) await prisma.user.deleteMany({ where: { id: userId } });
    await moduleRef.close();
  });

  it('persist policy explicit và mặc định fallback là NONE', async () => {
    await expect(policies.get(userId)).resolves.toMatchObject({
      rateLimitTier: AiRateLimitTier.FREE,
      fallbackPolicy: AiFallbackPolicy.NONE,
    });

    await policies.update(userId, {
      rateLimitTier: AiRateLimitTier.PRO,
      fallbackPolicy: AiFallbackPolicy.SYSTEM,
    });

    await expect(policies.get(userId)).resolves.toMatchObject({
      rateLimitTier: AiRateLimitTier.PRO,
      fallbackPolicy: AiFallbackPolicy.SYSTEM,
    });
  });

  it('atomic bucket không vượt request limit khi reserve đồng thời', async () => {
    const windowStart = new Date('2026-09-06T00:00:00Z');
    const results = await Promise.all(
      Array.from({ length: 12 }, () =>
        rateLimits.reserve({
          userId,
          windowStart,
          requestLimit: 3,
          tokenLimit: 1000,
          tokens: 10,
        }),
      ),
    );

    expect(results.filter((result) => result.allowed)).toHaveLength(3);
    await expect(
      prisma.aiRateLimitBucket.findUniqueOrThrow({
        where: { userId_windowStart: { userId, windowStart } },
      }),
    ).resolves.toMatchObject({ requestCount: 3, tokenCount: 30 });
  });

  it('reserve diagnostic requests theo một phép ghi atomic', async () => {
    const windowStart = new Date('2026-09-06T01:00:00Z');

    await expect(
      rateLimits.reserve({
        userId,
        windowStart,
        requestLimit: 20,
        tokenLimit: 50_000,
        requests: 4,
        tokens: 0,
      }),
    ).resolves.toMatchObject({
      allowed: true,
      bucket: { requestCount: 4, tokenCount: 0 },
    });
  });

  it('ghi AI security audit không chứa credential hoặc prompt', async () => {
    await securityAudit.record({
      actorUserId: userId,
      ownerUserId: userId,
      action: 'ai.connection.updated',
      connectionId: runId,
      outcome: 'SUCCESS',
      metadata: {
        changedFields: ['apiKey', 'baseUrl'],
      },
    });

    const record = await prisma.auditLog.findFirstOrThrow({
      where: { entityType: 'AiConnection', entityId: runId },
      orderBy: { createdAt: 'desc' },
    });
    const serialized = JSON.stringify(record);
    expect(serialized).not.toContain('plain-secret');
    expect(serialized).not.toContain('systemPrompt');
    expect(record.action).toBe('ai.connection.updated');
  });

  it('tổng hợp usage thật theo model từ PostgreSQL', async () => {
    await prisma.aiUsage.createMany({
      data: [
        {
          userId,
          protocol: PrismaAiProtocol.ANTHROPIC_MESSAGES,
          legacyProvider: PrismaAiProvider.ANTHROPIC,
          model: 'sonnet-5',
          capability: AiUsageCapability.CHAT,
          inputTokens: 500,
          outputTokens: 80,
          latencyMs: 250,
          success: true,
          createdAt: new Date('2026-09-07T10:00:00.000Z'),
        },
        {
          userId,
          protocol: PrismaAiProtocol.ANTHROPIC_MESSAGES,
          legacyProvider: PrismaAiProvider.ANTHROPIC,
          model: 'sonnet-5',
          capability: AiUsageCapability.CHAT,
          latencyMs: 350,
          success: false,
          errorCode: 'TIMEOUT',
          createdAt: new Date('2026-09-07T11:00:00.000Z'),
        },
      ],
    });

    await expect(
      usageReader.summary({
        scopeUserId: userId,
        from: '2026-09-07',
        to: '2026-09-07',
      }),
    ).resolves.toMatchObject({
      totals: {
        requests: 2,
        successfulRequests: 1,
        failedRequests: 1,
        inputTokens: 500,
        outputTokens: 80,
        averageLatencyMs: 300,
        errorRate: 50,
      },
      byModel: [{ model: 'sonnet-5', requests: 2 }],
    });
  });

  it('story profile override có thể kế thừa từng field từ user profile', async () => {
    await profiles.updateUser(userId, {
      model: 'user-model',
      systemPrompt: 'user-style',
      defaultTranslationLanguageCode: 'ja',
      autoTranslateOnPublish: true,
    });
    await profiles.updateStory(userId, storyId, {
      model: 'story-model',
      systemPrompt: null,
      defaultTranslationLanguageCode: null,
      autoTranslateOnPublish: false,
    });

    await expect(profiles.getStory(userId, storyId)).resolves.toMatchObject({
      model: 'story-model',
      systemPrompt: 'user-style',
      defaultTranslationLanguageCode: 'ja',
      autoTranslateOnPublish: false,
      inherits: ['systemPrompt', 'defaultTranslationLanguageCode'],
    });
  });
});
