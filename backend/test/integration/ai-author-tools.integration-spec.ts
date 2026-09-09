import { randomUUID } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import { AppConfigModule } from '@/config';
import { PrismaModule, PrismaService } from '@/infrastructure/database';
import { OutboxWriterService } from '@/infrastructure/queue/outbox';
import type { Prisma } from '@/generated/prisma/client';
import type { CreateOutboxEventInput } from '@/infrastructure/queue/outbox/outbox.types';
import { PrismaAiAuthorPersistence } from '@/modules/ai/infrastructure/persistence/prisma-ai-author.persistence';
import { AiAuthorKnowledgePersistence } from '@/modules/ai/infrastructure/persistence/ai-author-knowledge.persistence';
import { AiAuthorJobRunner } from '@/modules/ai/application/author-tools/ai-author-job.runner';
import { AiAuthorConnectionResolver } from '@/modules/ai/application/author-tools/ai-author-connection.resolver';
import type { AiGatewayPort } from '@/modules/ai/application/ports/ai-gateway.port';
import { snapshotAuthorSource } from '@/modules/ai/application/author-tools/ai-author-output';
import type {
  AuthorJob,
  CreateAuthorJob,
} from '@/modules/ai/application/author-tools/ai-author.types';

describe('AI author tools PostgreSQL transactions', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let persistence: PrismaAiAuthorPersistence;
  let userId: string;
  let collaboratorId: string;
  let storyId: string;
  let chapterId: string;
  let connectionId: string;
  const runId = randomUUID();
  const jobIds: string[] = [];
  const usage = {
    inputTokens: 8,
    outputTokens: 5,
    protocol: 'OPENAI_CHAT_COMPLETIONS',
    model: 'mock-model',
    connectionId: null,
  };
  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppConfigModule, PrismaModule],
      providers: [
        PrismaAiAuthorPersistence,
        AiAuthorKnowledgePersistence,
        {
          provide: OutboxWriterService,
          useValue: {
            create: (
              tx: Prisma.TransactionClient,
              input: CreateOutboxEventInput,
            ) =>
              tx.outboxEvent.create({
                data: {
                  aggregateType: input.aggregateType,
                  aggregateId: input.aggregateId,
                  eventType: input.eventType,
                  idempotencyKey: input.idempotencyKey,
                  payload: input.payload,
                  availableAt: input.availableAt,
                },
              }),
          },
        },
      ],
    }).compile();
    await moduleRef.init();
    prisma = moduleRef.get(PrismaService);
    persistence = moduleRef.get(PrismaAiAuthorPersistence);
    userId = (
      await prisma.user.create({
        data: {
          email: `ai-tools-${runId}@test.dev`,
          username: `at-${runId}`,
          displayName: 'AI Tools',
          emailVerifiedAt: new Date(),
        },
      })
    ).id;
    collaboratorId = (
      await prisma.user.create({
        data: {
          email: `ai-editor-${runId}@test.dev`,
          username: `ae-${runId}`,
          displayName: 'Editor',
          emailVerifiedAt: new Date(),
        },
      })
    ).id;
    await prisma.authorProfile.create({
      data: { userId, penName: 'AI Tools', slug: `at-${runId}` },
    });
    storyId = (
      await prisma.story.create({
        data: {
          authorId: userId,
          title: 'AI story',
          slug: `at-${runId}`,
          synopsis: '',
        },
      })
    ).id;
    chapterId = (
      await prisma.chapter.create({
        data: {
          storyId,
          createdById: userId,
          updatedById: userId,
          title: 'Chapter',
          content: 'PRIVATE DRAFT with An.',
          number: 1,
          slug: 'chapter',
        },
      })
    ).id;
    connectionId = (
      await prisma.aiConnection.create({
        data: {
          userId,
          name: 'Test',
          protocol: 'OPENAI_CHAT_COMPLETIONS',
          baseUrl: 'https://mock.test/v1',
          encryptedCredential: 'test',
          legacyProvider: 'OPENAI',
          legacyEncryptedApiKey: 'test',
        },
      })
    ).id;
  });
  afterAll(async () => {
    if (prisma && userId) {
      await prisma.outboxEvent.deleteMany({
        where: { aggregateId: { in: jobIds } },
      });
      await prisma.auditLog.deleteMany({
        where: { actorId: { in: [userId, collaboratorId] } },
      });
      await prisma.story.deleteMany({ where: { id: storyId } });
      await prisma.aiConnection.deleteMany({ where: { userId } });
      await prisma.authorProfile.deleteMany({ where: { userId } });
      await prisma.user.deleteMany({
        where: { id: { in: [userId, collaboratorId] } },
      });
    }
    await moduleRef?.close();
  });
  async function create(
    jobType: CreateAuthorJob['jobType'] = 'CHAPTER_SUMMARY',
    requester = userId,
  ) {
    const input: CreateAuthorJob = {
      userId: requester,
      storyId,
      connectionId,
      jobType,
      ...(jobType === 'CHAPTER_SUMMARY' || jobType === 'CONSISTENCY_CHECK'
        ? { chapterId }
        : {}),
    };
    const snapshot = snapshotAuthorSource(await persistence.source(input));
    const job = await persistence.create(input, snapshot);
    jobIds.push(job.id);
    return job;
  }
  it('deduplicates concurrent requests, persists outbox and fences two completions', async () => {
    const [first, duplicate] = await Promise.all([create(), create()]);
    expect(first.id).toBe(duplicate.id);
    expect(
      await prisma.outboxEvent.count({
        where: {
          aggregateId: first.id,
          idempotencyKey: { startsWith: 'ai.author-job.' },
        },
      }),
    ).toBe(1);
    expect(JSON.stringify(first.sourceSnapshot)).not.toContain('PRIVATE DRAFT');
    const claims = await Promise.all([
      persistence.claim(first.id, randomUUID()),
      persistence.claim(first.id, randomUUID()),
    ]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    const claimed = claims.find(Boolean)!;
    const completed = await Promise.all([
      persistence.complete(claimed, { summary: 'Summary' }, usage),
      persistence.complete(claimed, { summary: 'Duplicate' }, usage),
    ]);
    expect(completed.filter(Boolean)).toHaveLength(1);
    expect(
      await prisma.auditLog.count({
        where: { entityId: first.id, action: 'ai.author-job.completed' },
      }),
    ).toBe(1);
  });
  it('rejects changed content at completion and discards a cancelled in-flight result', async () => {
    const job = await create();
    const claimed = (await persistence.claim(job.id, randomUUID()))!;
    await prisma.chapter.update({
      where: { id: chapterId },
      data: { content: 'Changed PRIVATE DRAFT', version: { increment: 1 } },
    });
    await expect(
      persistence.complete(claimed, { summary: 'Stale' }, usage),
    ).rejects.toThrow('SOURCE_CHANGED');
    await persistence.fail(claimed, 'SOURCE_CHANGED');
    const retry = await create();
    const running = (await persistence.claim(retry.id, randomUUID()))!;
    await persistence.transition(userId, storyId, retry.id, 'cancel');
    expect(
      await persistence.complete(
        running,
        { summary: 'Cancelled result' },
        usage,
      ),
    ).toBe(false);
    expect((await persistence.find(retry.id))?.status).toBe('CANCELLED');
    expect((await persistence.find(retry.id))?.result).toBeNull();
  });
  it('runs a mocked provider through the worker and preserves author-verified characters', async () => {
    const existing = await prisma.storyCharacter.create({
      data: {
        storyId,
        name: 'An',
        aliases: [],
        description: 'Author verified description',
        isVerified: true,
      },
    });
    const job = await create('CHARACTER_EXTRACTION');
    const character = {
      name: 'An',
      aliases: [],
      description: 'AI replacement',
      firstAppearance: chapterId,
      appearances: [{ chapterId, role: 'main', mentions: 1 }],
      relationships: [],
    };
    const gateway = {
      generate: jest.fn().mockResolvedValue({
        content: JSON.stringify({ characters: [character] }),
        protocol: 'OPENAI_CHAT_COMPLETIONS',
        model: 'mock-model',
        latencyMs: 1,
        usage: { inputTokens: 9, outputTokens: 5 },
      }),
    };
    const connections = {
      execution: jest.fn().mockResolvedValue({ primary: {}, fallback: null }),
    };
    const runner = new AiAuthorJobRunner(
      persistence,
      connections as unknown as AiAuthorConnectionResolver,
      gateway as unknown as AiGatewayPort,
    );
    await runner.execute(job.id);
    await runner.execute(job.id);
    expect(gateway.generate).toHaveBeenCalledTimes(1);
    expect((await persistence.find(job.id))?.status).toBe('COMPLETED');
    expect(
      (
        await prisma.storyCharacter.findUniqueOrThrow({
          where: { id: existing.id },
        })
      ).description,
    ).toBe('Author verified description');
    const audits = await prisma.auditLog.findMany({
      where: { entityId: job.id },
    });
    expect(JSON.stringify(audits)).not.toMatch(/PRIVATE DRAFT|AI replacement/u);
  });
  it('persists one consistency issue with the source version and validates story access for dismissal', async () => {
    const job = await create('CONSISTENCY_CHECK');
    const running = (await persistence.claim(job.id, randomUUID()))!;
    const result = {
      issues: [
        {
          chapterId,
          issueType: 'PLOT_HOLE',
          severity: 'LOW',
          description: 'Potential mismatch',
          suggestion: 'Review timeline',
          relatedChapterIds: [],
        },
      ],
    };
    await persistence.complete(running, result, usage);
    expect(await persistence.complete(running, result, usage)).toBe(false);
    const issues = await persistence.issues(userId, storyId, chapterId);
    expect(issues).toHaveLength(1);
    expect(issues[0].sourceVersion).toBe(
      running.sourceSnapshot.chapters[0].version,
    );
    await expect(
      persistence.updateIssue(collaboratorId, storyId, issues[0].id, {
        isDismissed: true,
      }),
    ).rejects.toThrow('ACCESS_DENIED');
    await persistence.updateIssue(userId, storyId, issues[0].id, {
      isResolved: true,
    });
    expect((await persistence.issues(userId, storyId))[0].isResolved).toBe(
      true,
    );
  });
  it('rechecks collaborator permissions after enqueue and does not charge a revoked editor', async () => {
    await prisma.storyContributor.create({
      data: { storyId, userId: collaboratorId, role: 'EDITOR', canEdit: true },
    });
    const job = await create('CHAPTER_SUMMARY', collaboratorId);
    await prisma.storyContributor.deleteMany({
      where: { storyId, userId: collaboratorId },
    });
    const gateway = { generate: jest.fn() };
    const runner = new AiAuthorJobRunner(
      persistence,
      {} as AiAuthorConnectionResolver,
      gateway as unknown as AiGatewayPort,
    );
    await runner.execute(job.id);
    expect(gateway.generate).not.toHaveBeenCalled();
    expect((await persistence.find(job.id)) as AuthorJob).toMatchObject({
      status: 'FAILED',
      failureReason: 'ACCESS_DENIED',
    });
  });
});
