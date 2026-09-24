import {
  OcrChapterNotFoundException,
  OcrInvalidInputException,
  OcrPagesMissingException,
} from '../../domain';
import { RequestChapterOcrCommandHandler } from './request-chapter-ocr.command-handler';

describe('RequestChapterOcrCommandHandler', () => {
  const chapterId = '11111111-1111-4111-8111-111111111111';
  const requestedById = '22222222-2222-4222-8222-222222222222';

  let chapterExists: jest.Mock;
  let requestChapter: jest.Mock;
  let enqueueChapter: jest.Mock;
  let handler: RequestChapterOcrCommandHandler;

  beforeEach(() => {
    chapterExists = jest.fn().mockResolvedValue(true);
    requestChapter = jest.fn().mockResolvedValue(3);
    enqueueChapter = jest.fn().mockResolvedValue('job-1');

    handler = new RequestChapterOcrCommandHandler(
      { chapterExists, requestChapter } as never,
      { supportedLanguages: ['ch', 'japan'], maxBatchSize: 20 } as never,
      { enqueueChapter },
      { getOrThrow: () => ({ defaultLanguage: 'ch' }) } as never,
    );
  });

  it('queues every page of the chapter and reports the job', async () => {
    const result = await handler.execute({ chapterId, requestedById });

    expect(result).toEqual({
      chapterId,
      language: 'ch',
      queuedPages: 3,
      jobId: 'job-1',
    });
    expect(requestChapter).toHaveBeenCalledWith({
      chapterId,
      language: 'ch',
      requestedById,
    });
    expect(enqueueChapter).toHaveBeenCalledWith(chapterId, 'ch');
  });

  it('falls back to the configured language when none is given', async () => {
    await handler.execute({ chapterId, requestedById });

    expect(enqueueChapter).toHaveBeenCalledWith(chapterId, 'ch');
  });

  it('refuses a language the recogniser has no model for', async () => {
    await expect(
      handler.execute({ chapterId, requestedById, language: 'vi' }),
    ).rejects.toBeInstanceOf(OcrInvalidInputException);

    expect(requestChapter).not.toHaveBeenCalled();
    expect(enqueueChapter).not.toHaveBeenCalled();
  });

  it('rejects a chapter that does not exist before touching the queue', async () => {
    chapterExists.mockResolvedValue(false);

    await expect(
      handler.execute({ chapterId, requestedById }),
    ).rejects.toBeInstanceOf(OcrChapterNotFoundException);

    expect(enqueueChapter).not.toHaveBeenCalled();
  });

  it('does not queue a chapter that has no page images', async () => {
    requestChapter.mockResolvedValue(0);

    await expect(
      handler.execute({ chapterId, requestedById }),
    ).rejects.toBeInstanceOf(OcrPagesMissingException);

    expect(enqueueChapter).not.toHaveBeenCalled();
  });
});
