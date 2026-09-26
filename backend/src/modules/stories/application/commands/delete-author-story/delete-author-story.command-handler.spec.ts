import { AuthenticationRequiredException } from '@/common/exceptions';

import {
  StoryNotFoundException,
  StoryPendingReviewDeletionException,
} from '../../../domain';
import { DeleteAuthorStoryCommand } from './delete-author-story.command';
import { DeleteAuthorStoryCommandHandler } from './delete-author-story.command-handler';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const STORY_ID = '22222222-2222-4222-8222-222222222222';

describe('DeleteAuthorStoryCommandHandler', () => {
  let persistence: {
    findOwnedById: jest.Mock;
    deleteOwned: jest.Mock;
  };

  let refunds: { execute: jest.Mock };

  let handler: DeleteAuthorStoryCommandHandler;

  beforeEach(() => {
    persistence = {
      findOwnedById: jest.fn().mockResolvedValue({ id: STORY_ID }),
      deleteOwned: jest.fn().mockResolvedValue({ status: 'deleted' }),
    };

    refunds = { execute: jest.fn().mockResolvedValue({ refunded: 0 }) };

    handler = new DeleteAuthorStoryCommandHandler(
      persistence as never,
      refunds as never,
    );
  });

  it('yêu cầu authenticated author UUID hợp lệ', async () => {
    await expect(
      handler.execute(createCommand(undefined)),
    ).rejects.toBeInstanceOf(AuthenticationRequiredException);

    expect(persistence.deleteOwned).not.toHaveBeenCalled();
    expect(refunds.execute).not.toHaveBeenCalled();
  });

  it('gửi ownership scope, audit context và thời điểm soft delete', async () => {
    await handler.execute(
      new DeleteAuthorStoryCommand(
        USER_ID,
        STORY_ID,
        '127.0.0.1',
        'Jest',
        'story-delete-request',
      ),
    );

    expect(persistence.deleteOwned).toHaveBeenCalledWith({
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

  it('xóa được truyện đã xuất bản', async () => {
    persistence.findOwnedById.mockResolvedValue({
      id: STORY_ID,
      status: 'PUBLISHED',
    });

    await expect(
      handler.execute(createCommand(USER_ID)),
    ).resolves.toBeUndefined();

    expect(persistence.deleteOwned).toHaveBeenCalled();
  });

  it('hoàn tiền mọi lượt mua chương của truyện trước khi xóa', async () => {
    const order: string[] = [];
    refunds.execute.mockImplementation(() => {
      order.push('refund');
      return Promise.resolve({ refunded: 5 });
    });
    persistence.deleteOwned.mockImplementation(() => {
      order.push('delete');
      return Promise.resolve({ status: 'deleted' });
    });

    await handler.execute(createCommand(USER_ID));

    expect(order).toEqual(['refund', 'delete']);
    expect(refunds.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: USER_ID,
        scope: { storyId: STORY_ID },
        reason: expect.stringContaining('xoá') as unknown,
      }),
    );
  });

  it('không chạm tới tiền khi truyện không thuộc author', async () => {
    persistence.findOwnedById.mockResolvedValue(null);

    await expect(
      handler.execute(createCommand(USER_ID)),
    ).rejects.toBeInstanceOf(StoryNotFoundException);

    expect(refunds.execute).not.toHaveBeenCalled();
    expect(persistence.deleteOwned).not.toHaveBeenCalled();
  });

  it('giữ nguyên cổng chặn truyện đang chờ duyệt', async () => {
    persistence.deleteOwned.mockResolvedValue({
      status: 'story_pending_review',
    });

    await expect(
      handler.execute(createCommand(USER_ID)),
    ).rejects.toBeInstanceOf(StoryPendingReviewDeletionException);
  });

  it('ẩn truyện không tồn tại hoặc không thuộc author bằng not found', async () => {
    persistence.deleteOwned.mockResolvedValue({ status: 'not_found' });

    await expect(
      handler.execute(createCommand(USER_ID)),
    ).rejects.toBeInstanceOf(StoryNotFoundException);
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
