import { AuthenticationRequiredException } from '@/common/exceptions';

import { StoryNotFoundException } from '../../../domain';
import { ListAuthorChaptersQuery } from './list-author-chapters.query';
import { ListAuthorChaptersQueryHandler } from './list-author-chapters.query-handler';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const STORY_ID = '22222222-2222-4222-8222-222222222222';

describe('ListAuthorChaptersQueryHandler', () => {
  let persistence: { listOwnedByStory: jest.Mock };
  let handler: ListAuthorChaptersQueryHandler;

  beforeEach(() => {
    persistence = { listOwnedByStory: jest.fn() };
    handler = new ListAuthorChaptersQueryHandler(persistence as never);
  });

  it('yêu cầu authenticated author UUID hợp lệ', async () => {
    await expect(
      handler.execute(new ListAuthorChaptersQuery(undefined, STORY_ID)),
    ).rejects.toBeInstanceOf(AuthenticationRequiredException);
    expect(persistence.listOwnedByStory).not.toHaveBeenCalled();
  });

  it('không leak chapter list của story không thuộc author', async () => {
    persistence.listOwnedByStory.mockResolvedValue(null);

    await expect(
      handler.execute(new ListAuthorChaptersQuery(USER_ID, STORY_ID)),
    ).rejects.toBeInstanceOf(StoryNotFoundException);
  });

  it('map chapter summaries mà không cần load content', async () => {
    const now = new Date('2026-08-15T00:00:00.000Z');
    persistence.listOwnedByStory.mockResolvedValue([
      {
        id: '33333333-3333-4333-8333-333333333333',
        storyId: STORY_ID,
        number: 1,
        title: 'Chương 1',
        slug: 'chuong-1',
        status: 'DRAFT',
        wordCount: 120,
        version: 1,
        scheduledAt: null,
        publishedAt: null,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const result = await handler.execute(new ListAuthorChaptersQuery(USER_ID, STORY_ID));

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(expect.objectContaining({ number: 1, wordCount: 120 }));
  });
});
