import { AuthenticationRequiredException } from '@/common/exceptions';

import {
  ChapterDraftOnlyMutationException,
  ChapterNotFoundException,
} from '../../../domain';
import { DeleteAuthorChapterCommand } from './delete-author-chapter.command';
import { DeleteAuthorChapterCommandHandler } from './delete-author-chapter.command-handler';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const STORY_ID = '22222222-2222-4222-8222-222222222222';
const CHAPTER_ID = '33333333-3333-4333-8333-333333333333';

describe('DeleteAuthorChapterCommandHandler', () => {
  let persistence: {
    deleteDraft: jest.Mock;
  };

  let handler: DeleteAuthorChapterCommandHandler;

  beforeEach(() => {
    persistence = {
      deleteDraft: jest.fn(),
    };

    handler = new DeleteAuthorChapterCommandHandler(persistence as never);
  });

  it('yêu cầu authenticated author UUID hợp lệ', async () => {
    await expect(
      handler.execute(createCommand(undefined)),
    ).rejects.toBeInstanceOf(AuthenticationRequiredException);

    expect(persistence.deleteDraft).not.toHaveBeenCalled();
  });

  it('gửi ownership scope, audit context và thời điểm soft delete', async () => {
    persistence.deleteDraft.mockResolvedValue({
      status: 'deleted',
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

    expect(persistence.deleteDraft).toHaveBeenCalledWith({
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

  it('không cho xóa chapter không còn là draft', async () => {
    persistence.deleteDraft.mockResolvedValue({
      status: 'not_draft',
    });

    await expect(
      handler.execute(createCommand(USER_ID)),
    ).rejects.toBeInstanceOf(ChapterDraftOnlyMutationException);
  });

  it('ẩn chapter không tồn tại, story sai hoặc không thuộc author bằng not found', async () => {
    persistence.deleteDraft.mockResolvedValue({
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
