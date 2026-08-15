import { AuthenticationRequiredException } from '@/common/exceptions';

import { ListAuthorStoriesQuery } from './list-author-stories.query';
import { ListAuthorStoriesQueryHandler } from './list-author-stories.query-handler';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const STORY_ID = '22222222-2222-4222-8222-222222222222';

describe('ListAuthorStoriesQueryHandler', () => {
  let persistence: { listOwned: jest.Mock };
  let handler: ListAuthorStoriesQueryHandler;

  beforeEach(() => {
    persistence = { listOwned: jest.fn() };
    handler = new ListAuthorStoriesQueryHandler(persistence as never);
  });

  it('yêu cầu authenticated author UUID hợp lệ', async () => {
    await expect(handler.execute(new ListAuthorStoriesQuery(undefined))).rejects.toBeInstanceOf(
      AuthenticationRequiredException,
    );
    expect(persistence.listOwned).not.toHaveBeenCalled();
  });

  it('chỉ chuyển owned records từ persistence thành DTO', async () => {
    persistence.listOwned.mockResolvedValue([storyRecord()]);

    const result = await handler.execute(new ListAuthorStoriesQuery(USER_ID));

    expect(persistence.listOwned).toHaveBeenCalledWith(USER_ID);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(expect.objectContaining({ id: STORY_ID, authorId: USER_ID }));
  });
});

function storyRecord() {
  const now = new Date('2026-08-15T00:00:00.000Z');
  return {
    id: STORY_ID,
    authorId: USER_ID,
    title: 'Truyện Mới',
    slug: 'truyen-moi',
    synopsis: 'Mô tả',
    languageCode: 'vi',
    status: 'DRAFT',
    visibility: 'PRIVATE',
    contentRating: 'TEEN',
    coverMediaId: null,
    publishedAt: null,
    categories: [],
    tags: [],
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}
