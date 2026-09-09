import { ExternalServiceException } from '@/common/exceptions';

import { ChapterTranslationQueueAdapter } from './chapter-translation-queue.adapter';

const TRANSLATION_ID = '55555555-5555-4555-8555-555555555555';
const CHAPTER_ID = '33333333-3333-4333-8333-333333333333';

describe('ChapterTranslationQueueAdapter', () => {
  it('ném ExternalServiceException khi hàng đợi không khả dụng', async () => {
    const adapter = new ChapterTranslationQueueAdapter(undefined);

    await expect(
      adapter.enqueue({
        translationId: TRANSLATION_ID,
        chapterId: CHAPTER_ID,
        targetLanguageCode: 'en',
      }),
    ).rejects.toBeInstanceOf(ExternalServiceException);
  });

  it('enqueue job vào queue khi có sẵn', async () => {
    const queue = { add: jest.fn() };
    const adapter = new ChapterTranslationQueueAdapter(queue as never);

    await adapter.enqueue({
      translationId: TRANSLATION_ID,
      chapterId: CHAPTER_ID,
      targetLanguageCode: 'en',
    });

    expect(queue.add).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        translationId: TRANSLATION_ID,
        chapterId: CHAPTER_ID,
        targetLanguageCode: 'en',
      }),
      expect.objectContaining({ jobId: `${TRANSLATION_ID}-1` }),
    );
  });
});
