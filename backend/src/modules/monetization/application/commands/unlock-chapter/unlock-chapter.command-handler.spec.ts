import { createHash } from 'node:crypto';

import type { MonetizationPersistencePort } from '../../ports';
import { UnlockChapterCommand } from './unlock-chapter.command';
import { UnlockChapterCommandHandler } from './unlock-chapter.command-handler';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const CHAPTER_ID = '33333333-3333-4333-8333-333333333333';

describe('UnlockChapterCommandHandler', () => {
  it('normalizes the key, fingerprints the request, and serializes monetary values', async () => {
    const unlockChapter = jest.fn().mockResolvedValue({
      purchase: {
        id: '55555555-5555-4555-8555-555555555555',
        chapterId: CHAPTER_ID,
        storyId: '22222222-2222-4222-8222-222222222222',
        storySlug: 'story',
        storyTitle: 'Story',
        chapterNumber: 1,
        chapterTitle: 'Chapter',
        creditPrice: 25n,
        status: 'COMPLETED',
        walletTransactionId: '66666666-6666-4666-8666-666666666666',
        entitlementId: '77777777-7777-4777-8777-777777777777',
        createdAt: new Date('2026-09-07T00:00:00.000Z'),
      },
      walletBalance: 75n,
      replayed: false,
      alreadyOwned: false,
    });
    const persistence = {
      unlockChapter,
    } as unknown as MonetizationPersistencePort;
    const handler = new UnlockChapterCommandHandler(persistence);

    await expect(
      handler.execute(
        new UnlockChapterCommand(USER_ID, CHAPTER_ID, '  request-key-1  '),
      ),
    ).resolves.toMatchObject({
      walletBalance: '75',
      purchase: { creditPrice: '25' },
    });
    expect(unlockChapter).toHaveBeenCalledWith({
      userId: USER_ID,
      chapterId: CHAPTER_ID,
      idempotencyKey: 'request-key-1',
      requestHash: createHash('sha256')
        .update(JSON.stringify([USER_ID, CHAPTER_ID, 'CHAPTER_PURCHASE']))
        .digest('hex'),
    });
  });
});
