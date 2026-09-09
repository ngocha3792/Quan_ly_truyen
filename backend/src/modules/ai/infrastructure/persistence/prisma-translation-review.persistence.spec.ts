import { Prisma } from '@/generated/prisma/client';
import { createChapterContentDocument } from '@/modules/chapters';
import { PrismaTranslationReviewPersistence } from './prisma-translation-review.persistence';
import { computeChapterTranslationHash } from '../../application/chapter-translation/chapter-translation-hash.util';
import type { ReviewTranslationInput } from '../../application/ports/translation-review.port';

const input: ReviewTranslationInput = {
  userId: 'user',
  storyId: 'story',
  chapterId: 'chapter',
  translationId: 'translation',
  generation: 2,
  expectedVersion: 4,
  targetLanguageCode: 'en',
  decision: 'APPROVE',
  requestId: 'request',
};
function setup() {
  const original = {
    id: 'chapter',
    storyId: 'story',
    title: 'Tiêu đề',
    content: 'Đoạn cũ',
    contentFormat: 'MARKDOWN',
    version: 4,
    viewCount: 0n,
    number: new Prisma.Decimal(1),
    status: 'DRAFT',
    contentDocument: createChapterContentDocument('Đoạn cũ'),
    story: { status: 'PUBLISHED' },
  };
  const translation = {
    id: 'translation',
    chapterId: 'chapter',
    generation: 2,
    targetLanguageCode: 'en',
    requestedById: 'user',
    status: 'COMPLETED',
    reviewStatus: 'PENDING',
    translatedTitle: 'Title',
    translatedContent: 'Translated text',
    sourceContentHash: computeChapterTranslationHash({
      ...original,
      targetLanguageCode: 'en',
    }),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const tx = {
    $queryRaw: jest.fn(),
    chapter: {
      findFirst: jest.fn().mockResolvedValue(original),
      update: jest
        .fn()
        .mockImplementation(({ data }: { data: object }) =>
          Promise.resolve({ ...original, ...data, version: 5 }),
        ),
    },
    chapterTranslation: {
      findFirst: jest.fn().mockResolvedValue(translation),
      update: jest
        .fn()
        .mockImplementation(({ data }: { data: object }) =>
          Promise.resolve({ ...translation, ...data }),
        ),
    },
    auditLog: { create: jest.fn() },
  };
  const prisma = {
    $transaction: (fn: (client: typeof tx) => unknown) => fn(tx),
  };
  return {
    adapter: new PrismaTranslationReviewPersistence(prisma as never),
    tx,
    original,
    translation,
  };
}

describe('translation review transaction', () => {
  it('imports only explicitly approved text as a retained version with safe audit metadata', async () => {
    const { adapter, tx } = setup();
    const result = await adapter.review({
      ...input,
      translatedContent: 'Bản dịch đã chỉnh sửa',
    });
    expect(result.chapter).toMatchObject({
      version: 5,
      content: 'Bản dịch đã chỉnh sửa',
    });
    expect(tx.chapter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          versions: {
            create: expect.objectContaining({
              version: 5,
              isRetained: true,
              versionType: 'MANUAL_SAVE',
            }) as unknown,
          },
        }) as unknown,
      }),
    );
    expect(result.translation.reviewStatus).toBe('APPROVED');
    expect(() => JSON.stringify(result)).not.toThrow();
    expect(result.chapter).not.toHaveProperty('viewCount');
    expect(JSON.stringify(tx.auditLog.create.mock.calls)).not.toContain(
      'Bản dịch đã chỉnh sửa',
    );
  });
  it.each(['REJECT', 'REQUEST_REVISION'] as const)(
    'keeps chapter unchanged for %s',
    async (decision) => {
      const { adapter, tx } = setup();
      const result = await adapter.review({
        ...input,
        decision,
        notes: 'Sửa cách xưng hô',
      });
      expect(result.chapter).toBeNull();
      expect(tx.chapter.update).not.toHaveBeenCalled();
      expect(result.translation.revisionNotes).toBe('Sửa cách xưng hô');
    },
  );
  it('rejects changed source, stale version/generation, published chapter and revoked access before writes', async () => {
    for (const scenario of [
      'source',
      'version',
      'generation',
      'published',
      'access',
    ]) {
      const { adapter, tx, original, translation } = setup();
      if (scenario === 'source') original.content = 'New secret';
      if (scenario === 'version') original.version++;
      if (scenario === 'generation') translation.generation++;
      if (scenario === 'published') original.status = 'PUBLISHED';
      if (scenario === 'access') tx.chapter.findFirst.mockResolvedValue(null);
      await expect(adapter.review(input)).rejects.toThrow();
      expect(tx.chapter.update).not.toHaveBeenCalled();
      expect(tx.chapterTranslation.update).not.toHaveBeenCalled();
    }
  });
  it('requires the translation requester as well as current story membership', async () => {
    const { adapter, tx } = setup();
    tx.chapterTranslation.findFirst.mockResolvedValue(null);
    await expect(adapter.review(input)).rejects.toThrow();
    expect(tx.chapterTranslation.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        requestedById: input.userId,
        chapterId: input.chapterId,
      }) as unknown,
    });
  });
});
