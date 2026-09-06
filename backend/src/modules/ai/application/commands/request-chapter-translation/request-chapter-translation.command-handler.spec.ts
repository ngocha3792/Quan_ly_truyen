import {
  BusinessRuleViolationException,
  ResourceNotFoundException,
} from '@/common/exceptions';
import { AiProvider } from '../../../domain/enums';

import { computeChapterTranslationHash } from '../../chapter-translation/chapter-translation-hash.util';
import { RequestChapterTranslationCommand } from './request-chapter-translation.command';
import { RequestChapterTranslationCommandHandler } from './request-chapter-translation.command-handler';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const STORY_ID = '22222222-2222-4222-8222-222222222222';
const CHAPTER_ID = '33333333-3333-4333-8333-333333333333';
const CONNECTION_ID = '44444444-4444-4444-8444-444444444444';
const TRANSLATION_ID = '55555555-5555-4555-8555-555555555555';

const CHAPTER = { title: 'Chương 1', content: 'Nội dung chương 1' };

const CONNECTION = {
  id: CONNECTION_ID,
  provider: AiProvider.OPENAI,
};

describe('RequestChapterTranslationCommandHandler', () => {
  let chapters: { findOwnedById: jest.Mock };
  let translations: {
    findByChapterAndLanguage: jest.Mock;
    upsertPending: jest.Mock;
  };
  let resolver: { resolve: jest.Mock };
  let queue: { enqueue: jest.Mock };
  let handler: RequestChapterTranslationCommandHandler;

  beforeEach(() => {
    chapters = { findOwnedById: jest.fn().mockResolvedValue(CHAPTER) };
    translations = {
      findByChapterAndLanguage: jest.fn().mockResolvedValue(null),
      upsertPending: jest.fn(),
    };
    resolver = { resolve: jest.fn().mockResolvedValue(CONNECTION) };
    queue = { enqueue: jest.fn() };

    handler = new RequestChapterTranslationCommandHandler(
      chapters as never,
      translations as never,
      resolver as never,
      queue as never,
    );
  });

  it('ném ResourceNotFoundException khi chương không thuộc author', async () => {
    chapters.findOwnedById.mockResolvedValue(null);

    await expect(
      handler.execute(
        new RequestChapterTranslationCommand(USER_ID, STORY_ID, CHAPTER_ID, 'en'),
      ),
    ).rejects.toBeInstanceOf(ResourceNotFoundException);
  });

  it('ném BusinessRuleViolationException khi không resolve được connection', async () => {
    resolver.resolve.mockResolvedValue(null);

    await expect(
      handler.execute(
        new RequestChapterTranslationCommand(USER_ID, STORY_ID, CHAPTER_ID, 'en'),
      ),
    ).rejects.toBeInstanceOf(BusinessRuleViolationException);
    expect(translations.upsertPending).not.toHaveBeenCalled();
  });

  it('trả về ngay bản dịch cũ nếu đã COMPLETED và hash trùng, không enqueue lại', async () => {
    const sourceContentHash = computeChapterTranslationHash({
      title: CHAPTER.title,
      content: CHAPTER.content,
      targetLanguageCode: 'en',
    });

    translations.findByChapterAndLanguage.mockResolvedValue({
      id: TRANSLATION_ID,
      status: 'COMPLETED',
      targetLanguageCode: 'en',
      sourceContentHash,
    });

    const result = await handler.execute(
      new RequestChapterTranslationCommand(USER_ID, STORY_ID, CHAPTER_ID, 'en'),
    );

    expect(result).toEqual({
      id: TRANSLATION_ID,
      status: 'COMPLETED',
      targetLanguageCode: 'en',
    });
    expect(translations.upsertPending).not.toHaveBeenCalled();
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it('upsert PENDING và enqueue job khi chưa có bản dịch hợp lệ', async () => {
    translations.upsertPending.mockResolvedValue({
      id: TRANSLATION_ID,
      status: 'PENDING',
      targetLanguageCode: 'en',
    });

    const result = await handler.execute(
      new RequestChapterTranslationCommand(USER_ID, STORY_ID, CHAPTER_ID, 'en'),
    );

    expect(translations.upsertPending).toHaveBeenCalledWith(
      expect.objectContaining({
        chapterId: CHAPTER_ID,
        targetLanguageCode: 'en',
        requestedById: USER_ID,
        connectionId: CONNECTION_ID,
      }),
    );
    expect(queue.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        translationId: TRANSLATION_ID,
        chapterId: CHAPTER_ID,
        targetLanguageCode: 'en',
      }),
    );
    expect(result).toEqual({
      id: TRANSLATION_ID,
      status: 'PENDING',
      targetLanguageCode: 'en',
    });
  });
});
