import type { PrismaService } from '@/infrastructure/database';
import type { MetricsService } from '@/infrastructure/observability';
import type {
  CommentAbuseGuardPort,
  CommentWriteGuardPort,
} from '../../application/ports';
import { PrismaCommentInteractionPersistence } from './prisma-comment-interaction.persistence';

describe('PrismaCommentInteractionPersistence report evidence', () => {
  const timestamp = new Date('2026-09-09T00:00:00Z');
  const current = {
    id: 'reply',
    userId: 'author',
    storyId: 'story',
    chapterId: 'chapter',
    parentId: 'root',
    body: 'Reported reply',
    createdAt: timestamp,
    editedAt: null,
    deletedAt: null,
    moderationStatus: 'visible',
    anchor: null,
  };
  const anchor = {
    chapterId: 'chapter',
    chapterVersion: 2,
    lastVerifiedVersion: 3,
    status: 'ACTIVE',
    startBlockId: 'real-block',
    endBlockId: 'real-block',
    startOffset: 0,
    endOffset: 600,
    quoteText: 'q'.repeat(600),
  };

  function setup(withAnchor = true, blocked = false) {
    let storedData: unknown;
    const create = jest.fn((input: { data: unknown }) => {
      storedData = input.data;
      return Promise.resolve({
        id: 'report',
        status: 'OPEN',
        reason: 'SPAM',
        createdAt: timestamp,
      });
    });
    const tx = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([current])
        .mockResolvedValue([{ blocked: blocked ? 1n : 0n }]),
      comment: {
        findUnique: jest.fn(({ where }: { where: { id: string } }) =>
          Promise.resolve(
            where.id === 'reply'
              ? current
              : {
                  id: 'root',
                  parentId: null,
                  anchor: withAnchor ? anchor : null,
                },
          ),
        ),
      },
      chapter: { findUnique: jest.fn().mockResolvedValue({ version: 4 }) },
      report: { create },
    };
    const prisma = {
      $transaction: (work: (client: typeof tx) => Promise<unknown>) => work(tx),
    } as unknown as PrismaService;
    const persistence = new PrismaCommentInteractionPersistence(
      prisma,
      { consume: jest.fn() } as unknown as CommentAbuseGuardPort,
      {} as CommentWriteGuardPort,
      { recordCommentReport: jest.fn() } as unknown as MetricsService,
    );
    return { persistence, create, storedData: () => storedData };
  }

  it('ignores supplied hints, snapshots inherited DB context and caps the quote at 500 characters', async () => {
    const { persistence, storedData } = setup();
    const response = await persistence.createReport({
      userId: 'reporter',
      commentId: 'reply',
      reason: 'SPAM',
      anchorQuote: 'forged',
      chapterVersion: 999,
      anchorBlockId: 'forged-block',
    });
    const data = storedData();
    expect(data).toMatchObject({
      reportedUserId: 'author',
      storyId: 'story',
      chapterId: 'chapter',
      evidence: {
        comment: { body: 'Reported reply' },
        context: {
          source: 'SERVER',
          chapterVersion: 4,
          anchor: {
            blockId: 'real-block',
            quote: 'q'.repeat(500),
            chapterVersion: 2,
            lastVerifiedVersion: 3,
            rootCommentId: 'root',
          },
        },
      },
    });
    expect(JSON.stringify(data)).not.toContain('forged');
    expect(response).toEqual({
      id: 'report',
      status: 'OPEN',
      reason: 'SPAM',
      createdAt: timestamp.toISOString(),
    });
  });

  it('cannot manufacture an anchor on a regular thread', async () => {
    const { persistence, storedData } = setup(false);
    await persistence.createReport({
      userId: 'reporter',
      commentId: 'reply',
      reason: 'SPAM',
      anchorQuote: 'forged',
    });
    expect(storedData()).toMatchObject({
      evidence: { context: { anchor: null } },
    });
  });

  it('refuses reports hidden by an ancestor without persisting evidence', async () => {
    const { persistence, create } = setup(true, true);
    await expect(
      persistence.createReport({
        userId: 'reporter',
        commentId: 'reply',
        reason: 'SPAM',
      }),
    ).rejects.toMatchObject({ code: 'COMMENT_NOT_REPORTABLE' });
    expect(create).not.toHaveBeenCalled();
  });
});
