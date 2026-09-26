import { AuthenticationRequiredException } from '@/common/exceptions';

import {
  ChapterNotFoundException,
  ChapterStoryPendingReviewException,
} from '../../../domain';
import { DeleteAuthorChapterCommand } from './delete-author-chapter.command';
import { DeleteAuthorChapterCommandHandler } from './delete-author-chapter.command-handler';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const STORY_ID = '22222222-2222-4222-8222-222222222222';
const CHAPTER_ID = '33333333-3333-4333-8333-333333333333';

describe('DeleteAuthorChapterCommandHandler', () => {
  let persistence: {
    findOwnedById: jest.Mock;
    deleteOwned: jest.Mock;
  };

  let refunds: { execute: jest.Mock };

  let handler: DeleteAuthorChapterCommandHandler;

  beforeEach(() => {
    persistence = {
      findOwnedById: jest.fn().mockResolvedValue({ id: CHAPTER_ID }),
      deleteOwned: jest.fn().mockResolvedValue({ status: 'deleted' }),
    };

    refunds = { execute: jest.fn().mockResolvedValue({ refunded: 0 }) };

    handler = new DeleteAuthorChapterCommandHandler(
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
      new DeleteAuthorChapterCommand(
        USER_ID,
        STORY_ID,
        CHAPTER_ID,
        '127.0.0.1',
        'Jest',
        'chapter-delete-request',
      ),
    );

    expect(persistence.deleteOwned).toHaveBeenCalledWith({
      userId: USER_ID,
      storyId: STORY_ID,
      chapterId: CHAPTER_ID,
      deletedAt: expect.any(Date) as unknown,
      audit: {
        ipAddress: '127.0.0.1',
        userAgent: 'Jest',
        requestId: 'chapter-delete-request',
      },
    });
  });

  it('xóa được chapter đã xuất bản', async () => {
    persistence.findOwnedById.mockResolvedValue({
      id: CHAPTER_ID,
      status: 'PUBLISHED',
    });

    await expect(
      handler.execute(createCommand(USER_ID)),
    ).resolves.toBeUndefined();

    expect(persistence.deleteOwned).toHaveBeenCalled();
  });

  it('hoàn tiền mọi lượt mua của chương trước khi xóa', async () => {
    const order: string[] = [];
    refunds.execute.mockImplementation(() => {
      order.push('refund');
      return Promise.resolve({ refunded: 2 });
    });
    persistence.deleteOwned.mockImplementation(() => {
      order.push('delete');
      return Promise.resolve({ status: 'deleted' });
    });

    await handler.execute(
      new DeleteAuthorChapterCommand(
        USER_ID,
        STORY_ID,
        CHAPTER_ID,
        '127.0.0.1',
        'Jest',
        'chapter-delete-request',
      ),
    );

    expect(order).toEqual(['refund', 'delete']);
    expect(refunds.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: USER_ID,
        scope: { chapterId: CHAPTER_ID },
        reason: expect.stringContaining('xoá') as unknown,
        ipAddress: '127.0.0.1',
        userAgent: 'Jest',
        requestId: 'chapter-delete-request',
      }),
    );
  });

  it('không chạm tới tiền khi chapter không thuộc author', async () => {
    persistence.findOwnedById.mockResolvedValue(null);

    await expect(
      handler.execute(createCommand(USER_ID)),
    ).rejects.toBeInstanceOf(ChapterNotFoundException);

    expect(refunds.execute).not.toHaveBeenCalled();
    expect(persistence.deleteOwned).not.toHaveBeenCalled();
  });

  it('giữ nguyên cổng chặn truyện đang chờ duyệt', async () => {
    persistence.deleteOwned.mockResolvedValue({
      status: 'story_pending_review',
    });

    await expect(
      handler.execute(createCommand(USER_ID)),
    ).rejects.toBeInstanceOf(ChapterStoryPendingReviewException);
  });

  it('ẩn chapter không tồn tại, story sai hoặc không thuộc author bằng not found', async () => {
    persistence.deleteOwned.mockResolvedValue({
      status: 'not_found',
    });

    await expect(
      handler.execute(createCommand(USER_ID)),
    ).rejects.toBeInstanceOf(ChapterNotFoundException);
  });
});

function createCommand(userId: string | undefined): DeleteAuthorChapterCommand {
  return new DeleteAuthorChapterCommand(
    userId,
    STORY_ID,
    CHAPTER_ID,
    undefined,
    undefined,
    undefined,
  );
}
