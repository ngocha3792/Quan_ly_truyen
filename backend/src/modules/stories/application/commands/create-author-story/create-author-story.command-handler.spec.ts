import { AuthenticationRequiredException } from '@/common/exceptions';

import { AuthorProfileUnavailableException } from '../../../domain';

import { CreateAuthorStoryCommand } from './create-author-story.command';
import { CreateAuthorStoryCommandHandler } from './create-author-story.command-handler';

const USER_ID = '11111111-1111-4111-8111-111111111111';

const STORY_ID = '22222222-2222-4222-8222-222222222222';

describe('CreateAuthorStoryCommandHandler', () => {
  let persistence: {
    createDraft: jest.Mock;
  };

  let handler: CreateAuthorStoryCommandHandler;

  beforeEach(() => {
    persistence = {
      createDraft: jest.fn(),
    };

    handler = new CreateAuthorStoryCommandHandler(persistence as never);
  });

  it('yêu cầu authenticated author UUID hợp lệ', async () => {
    await expect(
      handler.execute(createCommand(undefined)),
    ).rejects.toBeInstanceOf(AuthenticationRequiredException);

    expect(persistence.createDraft).not.toHaveBeenCalled();
  });

  it('normalize title và synopsis trước khi persistence', async () => {
    persistence.createDraft.mockResolvedValue({
      status: 'created',
      story: createStoryRecord(),
    });

    const result = await handler.execute(
      new CreateAuthorStoryCommand(
        USER_ID,
        '   Truyện    Mới   ',
        '   Giới thiệu truyện.   ',
        '127.0.0.1',
        'Jest',
        'story-create-request',
      ),
    );

    expect(persistence.createDraft).toHaveBeenCalledWith({
      userId: USER_ID,
      title: 'Truyện Mới',
      synopsis: 'Giới thiệu truyện.',
      createdAt: expect.any(Date) as unknown,
      audit: {
        ipAddress: '127.0.0.1',
        userAgent: 'Jest',
        requestId: 'story-create-request',
      },
    });

    expect(result.id).toBe(STORY_ID);
  });

  it('cho phép tạo draft chưa có synopsis', async () => {
    persistence.createDraft.mockResolvedValue({
      status: 'created',
      story: createStoryRecord({ synopsis: '' }),
    });

    await handler.execute(
      new CreateAuthorStoryCommand(
        USER_ID,
        'Truyện Mới',
        undefined,
        undefined,
        undefined,
        undefined,
      ),
    );

    expect(persistence.createDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        synopsis: '',
      }),
    );
  });

  it('map author_not_found thành domain exception', async () => {
    persistence.createDraft.mockResolvedValue({
      status: 'author_not_found',
    });

    await expect(handler.execute(createCommand(USER_ID))).rejects.toBeInstanceOf(
      AuthorProfileUnavailableException,
    );
  });
});

function createCommand(userId: string | undefined): CreateAuthorStoryCommand {
  return new CreateAuthorStoryCommand(
    userId,
    'Truyện Mới',
    'Giới thiệu truyện.',
    undefined,
    undefined,
    undefined,
  );
}

function createStoryRecord(overrides: Partial<ReturnType<typeof storyRecord>> = {}) {
  return {
    ...storyRecord(),
    ...overrides,
  };
}

function storyRecord() {
  const now = new Date('2026-08-15T00:00:00.000Z');

  return {
    id: STORY_ID,
    authorId: USER_ID,
    title: 'Truyện Mới',
    slug: 'truyen-moi',
    synopsis: 'Giới thiệu truyện.',
    languageCode: 'vi',
    status: 'DRAFT',
    visibility: 'PRIVATE',
    contentRating: 'TEEN',
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}
