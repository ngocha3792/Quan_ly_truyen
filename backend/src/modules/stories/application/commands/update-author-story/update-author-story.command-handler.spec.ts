import { AuthenticationRequiredException } from '@/common/exceptions';

import {
  StoryDraftOnlyMutationException,
  StoryNotFoundException,
} from '../../../domain';

import { UpdateAuthorStoryCommand } from './update-author-story.command';
import { UpdateAuthorStoryCommandHandler } from './update-author-story.command-handler';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const STORY_ID = '22222222-2222-4222-8222-222222222222';

describe('UpdateAuthorStoryCommandHandler', () => {
  let persistence: {
    updateDraft: jest.Mock;
  };

  let handler: UpdateAuthorStoryCommandHandler;

  beforeEach(() => {
    persistence = {
      updateDraft: jest.fn(),
    };

    handler = new UpdateAuthorStoryCommandHandler(persistence as never);
  });

  it('yêu cầu authenticated author UUID hợp lệ', async () => {
    await expect(
      handler.execute(createCommand(undefined)),
    ).rejects.toBeInstanceOf(AuthenticationRequiredException);

    expect(persistence.updateDraft).not.toHaveBeenCalled();
  });

  it('normalize các field được PATCH và giữ undefined cho field không gửi', async () => {
    persistence.updateDraft.mockResolvedValue({
      status: 'updated',
      story: createStoryRecord(),
    });

    await handler.execute(
      new UpdateAuthorStoryCommand(
        USER_ID,
        STORY_ID,
        '   Tiêu đề    mới   ',
        undefined,
        '127.0.0.1',
        'Jest',
        'story-update-request',
      ),
    );

    expect(persistence.updateDraft).toHaveBeenCalledWith({
      userId: USER_ID,
      storyId: STORY_ID,
      title: 'Tiêu đề mới',
      synopsis: undefined,
      updatedAt: expect.any(Date) as unknown,
      audit: {
        ipAddress: '127.0.0.1',
        userAgent: 'Jest',
        requestId: 'story-update-request',
      },
    });
  });

  it('cho phép clear synopsis về chuỗi rỗng', async () => {
    persistence.updateDraft.mockResolvedValue({
      status: 'updated',
      story: createStoryRecord({ synopsis: '' }),
    });

    await handler.execute(
      new UpdateAuthorStoryCommand(
        USER_ID,
        STORY_ID,
        undefined,
        null,
        undefined,
        undefined,
        undefined,
      ),
    );

    expect(persistence.updateDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        synopsis: '',
      }),
    );
  });

  it('không cho sửa story không còn ở trạng thái draft', async () => {
    persistence.updateDraft.mockResolvedValue({
      status: 'not_draft',
    });

    await expect(handler.execute(createCommand(USER_ID))).rejects.toBeInstanceOf(
      StoryDraftOnlyMutationException,
    );
  });

  it('ẩn story không tồn tại hoặc không thuộc author bằng not found', async () => {
    persistence.updateDraft.mockResolvedValue({
      status: 'not_found',
    });

    await expect(handler.execute(createCommand(USER_ID))).rejects.toBeInstanceOf(
      StoryNotFoundException,
    );
  });
});

function createCommand(userId: string | undefined): UpdateAuthorStoryCommand {
  return new UpdateAuthorStoryCommand(
    userId,
    STORY_ID,
    'Tiêu đề mới',
    'Giới thiệu mới',
    undefined,
    undefined,
    undefined,
  );
}

function createStoryRecord(overrides: Record<string, unknown> = {}) {
  const now = new Date('2026-08-15T00:00:00.000Z');

  return {
    id: STORY_ID,
    authorId: USER_ID,
    title: 'Tiêu đề mới',
    slug: 'tieu-de-moi',
    synopsis: 'Giới thiệu mới',
    languageCode: 'vi',
    status: 'DRAFT',
    visibility: 'PRIVATE',
    contentRating: 'TEEN',
    version: 2,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
