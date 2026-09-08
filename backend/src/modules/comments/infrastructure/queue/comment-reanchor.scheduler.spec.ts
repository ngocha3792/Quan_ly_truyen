import { CommentAnchorStatus } from '@/generated/prisma/client';
import { createTextRangeAnchor } from '../../domain';
import { CommentReanchorScheduler } from './comment-reanchor.scheduler';

describe('CommentReanchorScheduler', () => {
  it('reanchors an outdated anchor and advances lastVerifiedVersion idempotently', async () => {
    const id = '11111111-1111-4111-8111-111111111111';
    const block = {
      id: '22222222-2222-4222-8222-222222222222',
      text: 'Một đoạn văn bản đủ dài để bình luận.',
    };
    const anchor = createTextRangeAnchor([block], block.id, 0, block.id, 24)!;
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ id }]),
      commentAnchor: {
        findMany: jest.fn().mockResolvedValue([
          {
            id,
            ...anchor,
            status: CommentAnchorStatus.ACTIVE,
            chapterVersion: 1,
            lastVerifiedVersion: 1,
            chapter: { version: 2, contentDocument: { blocks: [block] } },
          },
        ]),
        updateMany,
      },
    };
    const scheduler = new CommentReanchorScheduler(
      prisma as never,
      {
        inlineCommentsEnabled: true,
        inlineCommentsReanchorBatchSize: 50,
        inlineCommentsReanchorIntervalMs: 30_000,
      } as never,
    );
    await expect(scheduler.processBatch()).resolves.toBe(1);
    const calls = updateMany.mock.calls as unknown as ReadonlyArray<
      readonly [unknown]
    >;
    expect(calls[0]?.[0]).toMatchObject({
      where: { id, lastVerifiedVersion: 1 },
      data: {
        status: CommentAnchorStatus.REANCHORED,
        lastVerifiedVersion: 2,
      },
    });
  });
});
