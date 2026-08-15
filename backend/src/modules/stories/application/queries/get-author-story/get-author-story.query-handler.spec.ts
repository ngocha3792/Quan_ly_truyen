import { AuthenticationRequiredException } from '@/common/exceptions';

import { StoryNotFoundException } from '../../../domain';
import { GetAuthorStoryQuery } from './get-author-story.query';
import { GetAuthorStoryQueryHandler } from './get-author-story.query-handler';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const STORY_ID = '22222222-2222-4222-8222-222222222222';

describe('GetAuthorStoryQueryHandler', () => {
  let persistence: { findOwnedById: jest.Mock };
  let handler: GetAuthorStoryQueryHandler;

  beforeEach(() => {
    persistence = { findOwnedById: jest.fn() };
    handler = new GetAuthorStoryQueryHandler(persistence as never);
  });

  it('không query persistence nếu user chưa authenticated', async () => {
    await expect(
      handler.execute(new GetAuthorStoryQuery(undefined, STORY_ID)),
    ).rejects.toBeInstanceOf(AuthenticationRequiredException);
    expect(persistence.findOwnedById).not.toHaveBeenCalled();
  });

  it('trả 404 semantics khi story không thuộc author', async () => {
    persistence.findOwnedById.mockResolvedValue(null);

    await expect(
      handler.execute(new GetAuthorStoryQuery(USER_ID, STORY_ID)),
    ).rejects.toBeInstanceOf(StoryNotFoundException);
    expect(persistence.findOwnedById).toHaveBeenCalledWith(USER_ID, STORY_ID);
  });
});
