import { ChapterStoryNotFoundException } from '../../../domain';

import { ListPublicStoryChaptersQuery } from './list-public-story-chapters.query';
import { ListPublicStoryChaptersQueryHandler } from './list-public-story-chapters.query-handler';

describe('ListPublicStoryChaptersQueryHandler', () => {
  let persistence: { listPublishedByStory: jest.Mock };
  let handler: ListPublicStoryChaptersQueryHandler;

  beforeEach(() => {
    persistence = { listPublishedByStory: jest.fn() };
    handler = new ListPublicStoryChaptersQueryHandler(persistence as never);
  });

  it('normalize story slug trước khi query database', async () => {
    const list = {
      items: [],
      pagination: { page: 1, pageSize: 100, totalItems: 0, totalPages: 0 },
    };
    persistence.listPublishedByStory.mockResolvedValue(list);

    const result = await handler.execute(
      new ListPublicStoryChaptersQuery('  Truyen-Moi  ', 1, 100),
    );

    expect(persistence.listPublishedByStory).toHaveBeenCalledWith(
      'truyen-moi',
      1,
      100,
    );
    expect(result).toBe(list);
  });

  it('trả STORY_NOT_FOUND khi truyện không public hoặc không tồn tại', async () => {
    persistence.listPublishedByStory.mockResolvedValue(null);

    await expect(
      handler.execute(new ListPublicStoryChaptersQuery('truyen-moi', 1, 100)),
    ).rejects.toBeInstanceOf(ChapterStoryNotFoundException);
  });

  it('reject slug rỗng trước khi query database', async () => {
    await expect(
      handler.execute(new ListPublicStoryChaptersQuery('   ', 1, 100)),
    ).rejects.toBeInstanceOf(ChapterStoryNotFoundException);

    expect(persistence.listPublishedByStory).not.toHaveBeenCalled();
  });
});
