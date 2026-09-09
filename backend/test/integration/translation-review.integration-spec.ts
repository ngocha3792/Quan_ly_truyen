import { randomUUID } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import { AppConfigModule } from '@/config';
import { PrismaModule, PrismaService } from '@/infrastructure/database';
import { PrismaTranslationReviewPersistence } from '@/modules/ai/infrastructure/persistence/prisma-translation-review.persistence';
import { PrismaChapterTranslationPersistence } from '@/modules/ai/infrastructure/persistence/prisma-chapter-translation.persistence';
import { computeChapterTranslationHash } from '@/modules/ai/application/chapter-translation/chapter-translation-hash.util';

describe('translation review PostgreSQL', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let review: PrismaTranslationReviewPersistence;
  let translations: PrismaChapterTranslationPersistence;
  let userId: string;
  let storyId: string;
  let chapterId: string;
  let connectionId: string;
  const run = randomUUID();
  const source = {
    title: 'Ban đầu',
    content: 'Một chương tiếng Việt.',
    targetLanguageCode: 'en',
  };
  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppConfigModule, PrismaModule],
      providers: [
        PrismaTranslationReviewPersistence,
        PrismaChapterTranslationPersistence,
      ],
    }).compile();
    await moduleRef.init();
    prisma = moduleRef.get(PrismaService);
    review = moduleRef.get(PrismaTranslationReviewPersistence);
    translations = moduleRef.get(PrismaChapterTranslationPersistence);
    userId = (
      await prisma.user.create({
        data: {
          email: `translation-review-${run}@test.dev`,
          username: `tr-${run}`,
          displayName: 'Translation Review',
          emailVerifiedAt: new Date(),
        },
      })
    ).id;
    await prisma.authorProfile.create({
      data: { userId, penName: 'Translation', slug: `tr-${run}` },
    });
    storyId = (
      await prisma.story.create({
        data: {
          authorId: userId,
          title: 'Translation story',
          slug: `tr-${run}`,
          synopsis: '',
          status: 'DRAFT',
        },
      })
    ).id;
    chapterId = (
      await prisma.chapter.create({
        data: {
          storyId,
          createdById: userId,
          updatedById: userId,
          number: 1,
          title: source.title,
          content: source.content,
          slug: 'chapter-1',
          status: 'DRAFT',
          wordCount: 5,
        },
      })
    ).id;
    connectionId = (
      await prisma.aiConnection.create({
        data: {
          userId,
          name: 'Test',
          protocol: 'OPENAI_CHAT_COMPLETIONS',
          baseUrl: 'https://example.test/v1',
          encryptedCredential: 'test',
          defaultModel: 'test-model',
          legacyProvider: 'OPENAI',
          legacyEncryptedApiKey: 'test',
        },
      })
    ).id;
  });
  afterAll(async () => {
    if (prisma && userId) {
      await prisma.auditLog.deleteMany({ where: { actorId: userId } });
      await prisma.story.deleteMany({ where: { authorId: userId } });
      await prisma.aiConnection.deleteMany({ where: { userId } });
      await prisma.authorProfile.deleteMany({ where: { userId } });
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    await moduleRef?.close();
  });
  it('keeps review notes, fences stale worker results, and atomically imports one approved version', async () => {
    const pendingInput = {
      chapterId,
      requestedById: userId,
      connectionId,
      targetLanguageCode: 'en',
      sourceVersion: 1,
      sourceContentHash: computeChapterTranslationHash(source),
    };
    const first = await translations.upsertPending(pendingInput);
    const token = randomUUID();
    expect(
      await translations.markProcessing(first.id, first.generation!, token),
    ).toBe(true);
    await translations.markCompleted({
      translationId: first.id,
      generation: first.generation,
      leaseToken: token,
      translatedTitle: 'Title',
      translatedContent: 'First translation',
    });
    await review.review({
      userId,
      storyId,
      chapterId,
      targetLanguageCode: 'en',
      translationId: first.id,
      generation: first.generation!,
      expectedVersion: 1,
      decision: 'REQUEST_REVISION',
      notes: 'Keep the formal voice',
    });
    expect(
      (await prisma.chapter.findUniqueOrThrow({ where: { id: chapterId } }))
        .content,
    ).toBe(source.content);
    const second = await translations.upsertPending(pendingInput);
    expect(second.generation).toBe(first.generation! + 1);
    expect(second.revisionNotes).toBe('Keep the formal voice');
    await translations.markCompleted({
      translationId: first.id,
      generation: first.generation,
      leaseToken: token,
      translatedTitle: 'Stale',
      translatedContent: 'Stale body',
    });
    expect(
      (await translations.findById(first.id))?.translatedContent,
    ).toBeNull();
    const secondToken = randomUUID();
    expect(
      await translations.markProcessing(
        second.id,
        second.generation!,
        secondToken,
      ),
    ).toBe(true);
    await translations.markCompleted({
      translationId: second.id,
      generation: second.generation,
      leaseToken: secondToken,
      translatedTitle: 'Title',
      translatedContent: 'Reviewed translation',
    });
    const command = {
      userId,
      storyId,
      chapterId,
      targetLanguageCode: 'en',
      translationId: second.id,
      generation: second.generation!,
      expectedVersion: 1,
      decision: 'APPROVE' as const,
    };
    const results = await Promise.allSettled([
      review.review(command),
      review.review(command),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const chapter = await prisma.chapter.findUniqueOrThrow({
      where: { id: chapterId },
    });
    expect(chapter).toMatchObject({
      content: 'Reviewed translation',
      version: 2,
      status: 'DRAFT',
    });
    expect(chapter.contentDocument).not.toBeNull();
    expect(
      await prisma.chapterVersion.count({
        where: { chapterId, version: 2, isRetained: true },
      }),
    ).toBe(1);
    const audits = await prisma.auditLog.findMany({
      where: { actorId: userId, action: 'ai.translation.reviewed' },
    });
    expect(JSON.stringify(audits)).not.toContain('Reviewed translation');
    expect(JSON.stringify(audits)).not.toContain('Keep the formal voice');
  });
  it('denies import by an unrelated actor and rejects changed sources at request time', async () => {
    const translation = await translations.findByChapterAndLanguage(
      chapterId,
      'en',
    );
    await expect(
      review.review({
        userId: randomUUID(),
        storyId,
        chapterId,
        targetLanguageCode: 'en',
        translationId: translation!.id,
        generation: translation!.generation!,
        expectedVersion: 2,
        decision: 'APPROVE',
      }),
    ).rejects.toThrow();
    await expect(
      translations.upsertPending({
        chapterId,
        requestedById: userId,
        connectionId,
        targetLanguageCode: 'en',
        sourceVersion: 1,
        sourceContentHash: computeChapterTranslationHash(source),
      }),
    ).rejects.toThrow();
  });
});
