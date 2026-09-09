import { Prisma } from '@/generated/prisma/client';
import type { ChapterWorkflowMutation } from '../../application/ports/chapter-workflow.port';
import { PrismaChapterWorkflowPersistence } from './prisma-chapter-workflow.persistence';

const owner = '11111111-1111-4111-8111-111111111111';
const reviewer = '22222222-2222-4222-8222-222222222222';
const chapterId = '33333333-3333-4333-8333-333333333333';
const storyId = '44444444-4444-4444-8444-444444444444';

describe('Chapter review authorization and version invariant', () => {
  const row = () => ({
    id: chapterId,
    storyId,
    createdById: owner,
    updatedById: owner,
    title: 'Chapter',
    content: 'Unpublished content',
    contentFormat: 'MARKDOWN',
    contentDocument: null,
    wordCount: 2,
    version: 4,
    status: 'IN_REVIEW',
    number: new Prisma.Decimal(1),
    story: {
      authorId: owner,
      author: { lifecycleStatus: 'ACTIVE' },
      status: 'PUBLISHED',
      contributors: [],
    },
  });

  function setup() {
    const chapter = row();
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: chapterId }]),
      chapter: {
        findUnique: jest.fn().mockResolvedValue({ storyId }),
        findFirst: jest.fn().mockResolvedValue(chapter),
        update: jest
          .fn()
          .mockResolvedValue({ ...chapter, status: 'APPROVED', version: 5 }),
      },
      userRole: {
        findFirst: jest.fn().mockResolvedValue({ roleId: 'reviewer-role' }),
      },
      chapterReview: { create: jest.fn() },
      chapterEditSession: { deleteMany: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn((operation: (transaction: typeof tx) => unknown) =>
        operation(tx),
      ),
    };
    return {
      chapter,
      tx,
      persistence: new PrismaChapterWorkflowPersistence(prisma as never),
    };
  }

  const input = (
    overrides: Partial<ChapterWorkflowMutation> = {},
  ): ChapterWorkflowMutation => ({
    userId: reviewer,
    chapterId,
    expectedVersion: 4,
    action: 'APPROVED',
    audit: { requestId: 'review-request' },
    ...overrides,
  });

  it('checks reviewer permission in persistence before any write', async () => {
    const { tx, persistence } = setup();
    tx.userRole.findFirst.mockResolvedValue(null);
    await expect(persistence.transition(input())).rejects.toMatchObject({
      category: 'FORBIDDEN',
    });
    expect(tx.chapterReview.create).not.toHaveBeenCalled();
    expect(tx.chapter.update).not.toHaveBeenCalled();
  });

  it('rejects self-review even with the reviewer permission', async () => {
    const { tx, persistence } = setup();
    await expect(
      persistence.transition(input({ userId: owner })),
    ).rejects.toMatchObject({ category: 'FORBIDDEN' });
    expect(tx.chapterReview.create).not.toHaveBeenCalled();
  });

  it('rejects the stale review before creating a decision or snapshot', async () => {
    const { tx, persistence } = setup();
    await expect(
      persistence.transition(input({ expectedVersion: 3 })),
    ).rejects.toMatchObject({
      code: 'CHAPTER_VERSION_CONFLICT',
      details: { currentVersion: 4 },
    });
    expect(tx.chapterReview.create).not.toHaveBeenCalled();
    expect(tx.chapter.update).not.toHaveBeenCalled();
  });

  it('does not approve a draft without a submitted review', async () => {
    const { chapter, tx, persistence } = setup();
    chapter.status = 'DRAFT';
    await expect(persistence.transition(input())).rejects.toMatchObject({
      code: 'CHAPTER_INVALID_TRANSITION',
    });
    expect(tx.chapterReview.create).not.toHaveBeenCalled();
  });

  it('retains a reviewed snapshot and records the exact reviewed version and audit context', async () => {
    const { tx, persistence } = setup();
    const result = await persistence.transition(input());
    expect(result).toMatchObject({ status: 'APPROVED', version: 5 });
    expect(tx.chapterReview.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reviewerId: reviewer,
        decision: 'APPROVED',
        reviewedVersion: 4,
      }) as unknown,
    });
    expect(tx.chapter.update).toHaveBeenCalledWith({
      where: { id: chapterId },
      data: expect.objectContaining({
        status: 'APPROVED',
        version: 5,
        versions: {
          create: expect.objectContaining({
            version: 5,
            isRetained: true,
            content: 'Unpublished content',
          }) as unknown,
        },
      }) as unknown,
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: reviewer,
        requestId: 'review-request',
        oldValues: { status: 'IN_REVIEW', version: 4 },
        newValues: { status: 'APPROVED', version: 5, reviewedVersion: 4 },
      }) as unknown,
    });
  });

  it('requires the active owner for submit and reopen', async () => {
    const { chapter, tx, persistence } = setup();
    chapter.status = 'APPROVED';
    await expect(
      persistence.transition(input({ action: 'reopen' })),
    ).rejects.toMatchObject({ category: 'FORBIDDEN' });
    chapter.story.author.lifecycleStatus = 'SUSPENDED';
    await expect(
      persistence.transition(input({ userId: owner, action: 'reopen' })),
    ).rejects.toMatchObject({ category: 'FORBIDDEN' });
    expect(tx.chapter.update).not.toHaveBeenCalled();
  });
});
