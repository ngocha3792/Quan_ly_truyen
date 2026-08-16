import { AuthenticationRequiredException } from '@/common/exceptions';

import {
  AuthorProfileUnavailableException,
  InvalidStoryCategoriesException,
  InvalidStoryTagsException,
} from '../../../domain';

import { CreateAuthorStoryCommand } from './create-author-story.command';
import { CreateAuthorStoryCommandHandler } from './create-author-story.command-handler';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const STORY_ID = '22222222-2222-4222-8222-222222222222';
const CATEGORY_ID = '33333333-3333-4333-8333-333333333333';
const TAG_ID = '44444444-4444-4444-8444-444444444444';

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

  it('normalize title, synopsis và taxonomy trước khi persistence', async () => {
    persistence.createDraft.mockResolvedValue({
      status: 'created',
      story: createStoryRecord(),
    });

    const result = await handler.execute(
      new CreateAuthorStoryCommand(
        USER_ID,
        '   Truyện    Mới   ',
        '   Giới thiệu truyện.   ',
        [CATEGORY_ID, CATEGORY_ID],
        [TAG_ID, TAG_ID],
        '127.0.0.1',
        'Jest',
        'story-create-request',
      ),
    );

    expect(persistence.createDraft).toHaveBeenCalledWith({
      userId: USER_ID,
      title: 'Truyện Mới',
      synopsis: 'Giới thiệu truyện.',
      categoryIds: [CATEGORY_ID],
      tagIds: [TAG_ID],
      createdAt: expect.any(Date) as unknown,
      audit: {
        ipAddress: '127.0.0.1',
        userAgent: 'Jest',
        requestId: 'story-create-request',
      },
    });

    expect(result.id).toBe(STORY_ID);
  });

  it('cho phép tạo draft chưa có synopsis hoặc taxonomy', async () => {
    persistence.createDraft.mockResolvedValue({
      status: 'created',
      story: createStoryRecord({ synopsis: '', categories: [], tags: [] }),
    });

    await handler.execute(
      new CreateAuthorStoryCommand(
        USER_ID,
        'Truyện Mới',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      ),
    );

    expect(persistence.createDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        synopsis: '',
        categoryIds: [],
        tagIds: [],
      }),
    );
  });

  it('map category không hợp lệ thành domain exception', async () => {
    persistence.createDraft.mockResolvedValue({
      status: 'invalid_categories',
      invalidIds: [CATEGORY_ID],
    });

    await expect(
      handler.execute(createCommand(USER_ID)),
    ).rejects.toBeInstanceOf(InvalidStoryCategoriesException);
  });

  it('map tag không hợp lệ thành domain exception', async () => {
    persistence.createDraft.mockResolvedValue({
      status: 'invalid_tags',
      invalidIds: [TAG_ID],
    });

    await expect(
      handler.execute(createCommand(USER_ID)),
    ).rejects.toBeInstanceOf(InvalidStoryTagsException);
  });

  it('map author_not_found thành domain exception', async () => {
    persistence.createDraft.mockResolvedValue({
      status: 'author_not_found',
    });

    await expect(
      handler.execute(createCommand(USER_ID)),
    ).rejects.toBeInstanceOf(AuthorProfileUnavailableException);
  });
});

function createCommand(userId: string | undefined): CreateAuthorStoryCommand {
  return new CreateAuthorStoryCommand(
    userId,
    'Truyện Mới',
    'Giới thiệu truyện.',
    [CATEGORY_ID],
    [TAG_ID],
    undefined,
    undefined,
    undefined,
  );
}

function createStoryRecord(overrides: Record<string, unknown> = {}) {
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
    coverMediaId: null,
    publishedAt: null,
    categories: [
      {
        id: CATEGORY_ID,
        name: 'Tiên hiệp',
        slug: 'tien-hiep',
        isPrimary: true,
      },
    ],
    tags: [
      {
        id: TAG_ID,
        name: 'Tu tiên',
        slug: 'tu-tien',
      },
    ],
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}
