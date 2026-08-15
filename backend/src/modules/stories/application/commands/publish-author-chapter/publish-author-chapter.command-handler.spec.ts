import {
  ChapterEmptyContentException,
  ChapterStoryNotPublishedException,
} from '../../../domain';
import { PublishAuthorChapterCommand } from './publish-author-chapter.command';
import { PublishAuthorChapterCommandHandler } from './publish-author-chapter.command-handler';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const STORY_ID = '22222222-2222-4222-8222-222222222222';
const CHAPTER_ID = '33333333-3333-4333-8333-333333333333';

describe('PublishAuthorChapterCommandHandler', () => {
  let persistence: { publish: jest.Mock; };
  let handler: PublishAuthorChapterCommandHandler;

  beforeEach(() => {
    persistence = { publish: jest.fn() };
    handler = new PublishAuthorChapterCommandHandler(persistence as never);
  });

  it('publish chapter của chính author', async () => {
    const now = new Date('2026-08-15T00:00:00.000Z');
    persistence.publish.mockResolvedValue({
      status: 'published',
      chapter: {
        id: CHAPTER_ID,
        storyId: STORY_ID,
        createdById: USER_ID,
        updatedById: USER_ID,
        number: 1,
        title: 'Chương 1',
        slug: 'chuong-1',
        content: 'Nội dung',
        contentFormat: 'MARKDOWN',
        status: 'PUBLISHED',
        wordCount: 2,
        version: 1,
        scheduledAt: null,
        publishedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    });

    const result = await handler.execute(command());
    expect(persistence.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        storyId: STORY_ID,
        chapterId: CHAPTER_ID,
        publishedAt: expect.any(Date) as unknown,
      }),
    );
    expect(result.status).toBe('PUBLISHED');
  });

  it('không publish chapter trước khi story published', async () => {
    persistence.publish.mockResolvedValue({ status: 'story_not_published' });
    await expect(handler.execute(command())).rejects.toBeInstanceOf(
      ChapterStoryNotPublishedException,
    );
  });

  it('không publish chapter rỗng', async () => {
    persistence.publish.mockResolvedValue({ status: 'empty_content' });
    await expect(handler.execute(command())).rejects.toBeInstanceOf(
      ChapterEmptyContentException,
    );
  });
});

function command() {
  return new PublishAuthorChapterCommand(
    USER_ID,
    STORY_ID,
    CHAPTER_ID,
    undefined,
    undefined,
    undefined,
  );
}
