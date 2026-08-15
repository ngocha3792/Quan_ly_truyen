import { AuthenticationRequiredException } from '@/common/exceptions';

import {
  StoryDraftOnlyMutationException,
  StoryNotFoundException,
} from '../../../domain';

import { DeleteAuthorStoryCommand } from './delete-author-story.command';
import { DeleteAuthorStoryCommandHandler } from './delete-author-story.command-handler';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const STORY_ID = '22222222-2222-4222-8222-222222222222';

describe('DeleteAuthorStoryCommandHandler', () => {
  let persistence: {
    deleteDraft: jest.Mock;
  };

  let handler: DeleteAuthorStoryCommandHandler;

  beforeEach(() => {
    persistence = {
      deleteDraft: jest.fn(),
    };

    handler = new DeleteAuthorStoryCommandHandler(persistence as never);
  });

  it('yêu cầu authenticated author UUID hợp lệ', async () => {
    await expect(
      handler.execute(createCommand(undefined)),
    ).rejects.toBeInstanceOf(AuthenticationRequiredException);

    expect(persistence.deleteDraft).not.toHaveBeenCalled();
  });

  it('gửi audit context và thời điểm soft delete xuống persistence', async () => {
    persistence.deleteDraft.mockResolvedValue({
      status: 'deleted',
    });

    await handler.execute(
      new DeleteAuthorStoryCommand(
        USER_ID,
        STORY_ID,
        '127.0.0.1',
        'Jest',
        'story-delete-request',
      ),
    );

    expect(persistence.deleteDraft).toHaveBeenCalledWith({
      userId: USER_ID,
      storyId: STORY_ID,
      deletedAt: expect.any(Date) as unknown,
      audit: {
        ipAddress: '127.0.0.1',
        userAgent: 'Jest',
        requestId: 'story-delete-request',
      },
    });
  });

  it('không cho xóa story không còn là draft', async () => {
    persistence.deleteDraft.mockResolvedValue({
      status: 'not_draft',
    });

    await expect(handler.execute(createCommand(USER_ID))).rejects.toBeInstanceOf(
      StoryDraftOnlyMutationException,
    );
  });

  it('ẩn story không tồn tại hoặc không thuộc author bằng not found', async () => {
    persistence.deleteDraft.mockResolvedValue({
      status: 'not_found',
    });

    await expect(handler.execute(createCommand(USER_ID))).rejects.toBeInstanceOf(
      StoryNotFoundException,
    );
  });
});

function createCommand(userId: string | undefined): DeleteAuthorStoryCommand {
  return new DeleteAuthorStoryCommand(
    userId,
    STORY_ID,
    undefined,
    undefined,
    undefined,
  );
}
