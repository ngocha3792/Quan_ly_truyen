import { AuthenticationRequiredException } from '@/common/exceptions';

import {
  InvalidStoryCategoriesException,
  InvalidStoryCoverException,
  InvalidStoryTagsException,
  StoryDraftOnlyMutationException,
  StoryNotFoundException,
} from '../../../domain';

import { UpdateAuthorStoryCommand } from './update-author-story.command';
import { UpdateAuthorStoryCommandHandler } from './update-author-story.command-handler';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const STORY_ID = '22222222-2222-4222-8222-222222222222';
const CATEGORY_ID = '33333333-3333-4333-8333-333333333333';
const TAG_ID = '44444444-4444-4444-8444-444444444444';
const COVER_ID = '55555555-5555-4555-8555-555555555555';

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

  it('normalize các field PATCH và giữ undefined cho field không gửi', async () => {
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
        [CATEGORY_ID, CATEGORY_ID],
        undefined,
        COVER_ID,
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
      categoryIds: [CATEGORY_ID],
      tagIds: undefined,
      coverMediaId: COVER_ID,
      publishedAt: null,
      updatedAt: expect.any(Date) as unknown,
      audit: {
        ipAddress: '127.0.0.1',
        userAgent: 'Jest',
        requestId: 'story-update-request',
      },
    });
  });

  it('cho phép clear synopsis, category, tag và cover', async () => {
    persistence.updateDraft.mockResolvedValue({
      status: 'updated',
      story: createStoryRecord({
        synopsis: '',
        categories: [],
        tags: [],
        coverMediaId: null,
        publishedAt: null,
      }),
    });

    await handler.execute(
      new UpdateAuthorStoryCommand(
        USER_ID,
        STORY_ID,
        undefined,
        null,
        [],
        [],
        null,
        undefined,
        undefined,
        undefined,
      ),
    );

    expect(persistence.updateDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        synopsis: '',
        categoryIds: [],
        tagIds: [],
        coverMediaId: null,
        publishedAt: null,
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

  it('map category không hợp lệ thành domain exception', async () => {
    persistence.updateDraft.mockResolvedValue({
      status: 'invalid_categories',
      invalidIds: [CATEGORY_ID],
    });

    await expect(handler.execute(createCommand(USER_ID))).rejects.toBeInstanceOf(
      InvalidStoryCategoriesException,
    );
  });

  it('map tag không hợp lệ thành domain exception', async () => {
    persistence.updateDraft.mockResolvedValue({
      status: 'invalid_tags',
      invalidIds: [TAG_ID],
    });

    await expect(handler.execute(createCommand(USER_ID))).rejects.toBeInstanceOf(
      InvalidStoryTagsException,
    );
  });

  it('map cover không hợp lệ thành domain exception', async () => {
    persistence.updateDraft.mockResolvedValue({
      status: 'invalid_cover',
    });

    await expect(handler.execute(createCommand(USER_ID))).rejects.toBeInstanceOf(
      InvalidStoryCoverException,
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
    [CATEGORY_ID],
    [TAG_ID],
    COVER_ID,
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
    coverMediaId: COVER_ID,
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
    version: 2,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
