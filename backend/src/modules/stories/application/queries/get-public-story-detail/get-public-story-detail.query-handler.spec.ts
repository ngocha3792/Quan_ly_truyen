import { StoryNotFoundException } from '../../../domain';

import { GetPublicStoryDetailQuery } from './get-public-story-detail.query';
import { GetPublicStoryDetailQueryHandler } from './get-public-story-detail.query-handler';

describe('GetPublicStoryDetailQueryHandler', () => {
  let persistence: { findPublicBySlug: jest.Mock };
  let handler: GetPublicStoryDetailQueryHandler;

  beforeEach(() => {
    persistence = { findPublicBySlug: jest.fn() };
    handler = new GetPublicStoryDetailQueryHandler(persistence as never);
  });

  it('normalize slug trước khi lookup', async () => {
    const story = { id: 'story-id' };
    persistence.findPublicBySlug.mockResolvedValue(story);

    const result = await handler.execute(
      new GetPublicStoryDetailQuery('  Truyen-Moi  '),
    );

    expect(persistence.findPublicBySlug).toHaveBeenCalledWith('truyen-moi');
    expect(result).toBe(story);
  });

  it('trả STORY_NOT_FOUND khi slug không public hoặc không tồn tại', async () => {
    persistence.findPublicBySlug.mockResolvedValue(null);

    await expect(
      handler.execute(new GetPublicStoryDetailQuery('khong-ton-tai')),
    ).rejects.toBeInstanceOf(StoryNotFoundException);
  });
});
