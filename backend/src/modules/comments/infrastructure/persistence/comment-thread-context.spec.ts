import type { Prisma } from '@/generated/prisma/client';
import {
  assertInlineThreadAccess,
  findThreadAnchor,
} from './comment-thread-context';

describe('inline thread context and access', () => {
  it('finds the root anchor through both reply levels', async () => {
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce({ id: 'reply2', parentId: 'reply1', anchor: null })
      .mockResolvedValueOnce({ id: 'reply1', parentId: 'root', anchor: null })
      .mockResolvedValueOnce({
        id: 'root',
        parentId: null,
        anchor: { chapterId: 'chapter', startBlockId: 'block' },
      });
    await expect(
      findThreadAnchor(
        { comment: { findUnique } } as unknown as Prisma.TransactionClient,
        'reply2',
      ),
    ).resolves.toMatchObject({
      chapterId: 'chapter',
      startBlockId: 'block',
      rootCommentId: 'root',
    });
    expect(findUnique).toHaveBeenCalledTimes(3);
  });

  it('bounds invalid cyclic ancestor data rather than looping', async () => {
    const findUnique = jest
      .fn()
      .mockResolvedValue({ id: 'reply', parentId: 'reply', anchor: null });
    await expect(
      findThreadAnchor(
        { comment: { findUnique } } as unknown as Prisma.TransactionClient,
        'reply',
      ),
    ).resolves.toBeNull();
    expect(findUnique).toHaveBeenCalledTimes(3);
  });

  it('rejects a paid reply without ownership, contributor/admin role or entitlement', async () => {
    const tx = accessTransaction();
    await expect(
      assertInlineThreadAccess(
        tx as unknown as Prisma.TransactionClient,
        'reader',
        'chapter',
      ),
    ).rejects.toMatchObject({ code: 'CHAPTER_NOT_FOUND' });
    expect(tx.chapterEntitlement.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'reader', chapterId: 'chapter', status: 'ACTIVE' },
      }),
    );
  });

  it('accepts paid entitlement and never requests the paid body for access checks', async () => {
    const tx = accessTransaction();
    tx.chapterEntitlement.findFirst.mockResolvedValue({ id: 'entitlement' });
    await expect(
      assertInlineThreadAccess(
        tx as unknown as Prisma.TransactionClient,
        'reader',
        'chapter',
      ),
    ).resolves.toBeUndefined();
    const query = tx.chapter.findFirst.mock.calls[0][0] as {
      select: Record<string, unknown>;
    };
    expect(query.select).not.toHaveProperty('content');
    expect(query.select).not.toHaveProperty('contentDocument');
  });

  function accessTransaction() {
    const findChapter = jest.fn<Promise<unknown>, [unknown]>();
    findChapter.mockResolvedValue({
      storyId: 'story',
      story: { authorId: 'author' },
      monetization: { accessType: 'PAID' },
    });
    return {
      chapter: {
        findFirst: findChapter,
      },
      storyContributor: { findFirst: jest.fn().mockResolvedValue(null) },
      userRole: { findFirst: jest.fn().mockResolvedValue(null) },
      chapterEntitlement: { findFirst: jest.fn().mockResolvedValue(null) },
    };
  }
});
