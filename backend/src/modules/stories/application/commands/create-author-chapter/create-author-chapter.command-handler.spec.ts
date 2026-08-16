import { AuthenticationRequiredException } from '@/common/exceptions';

import { StoryNotFoundException } from '../../../domain';
import { CreateAuthorChapterCommand } from './create-author-chapter.command';
import { CreateAuthorChapterCommandHandler } from './create-author-chapter.command-handler';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const STORY_ID = '22222222-2222-4222-8222-222222222222';
const CHAPTER_ID = '33333333-3333-4333-8333-333333333333';

describe('CreateAuthorChapterCommandHandler', () => {
  let persistence: {
    createDraft: jest.Mock;
  };

  let handler: CreateAuthorChapterCommandHandler;

  beforeEach(() => {
    persistence = {
      createDraft: jest.fn(),
    };

    handler = new CreateAuthorChapterCommandHandler(persistence as never);
  });

  it('yêu cầu authenticated author UUID hợp lệ', async () => {
    await expect(
      handler.execute(createCommand(undefined)),
    ).rejects.toBeInstanceOf(AuthenticationRequiredException);

    expect(persistence.createDraft).not.toHaveBeenCalled();
  });

  it('normalize title, line endings và tính word count trước persistence', async () => {
    persistence.createDraft.mockResolvedValue({
      status: 'created',
      chapter: createChapterRecord(),
    });

    const result = await handler.execute(
      new CreateAuthorChapterCommand(
        USER_ID,
        STORY_ID,
        '   Chương    Một   ',
        'Xin chào\r\nthế giới',
        '127.0.0.1',
        'Jest',
        'chapter-create-request',
      ),
    );

    expect(persistence.createDraft).toHaveBeenCalledWith({
      userId: USER_ID,
      storyId: STORY_ID,
      title: 'Chương Một',
      content: 'Xin chào\nthế giới',
      wordCount: 4,
      createdAt: expect.any(Date) as unknown,
      audit: {
        ipAddress: '127.0.0.1',
        userAgent: 'Jest',
        requestId: 'chapter-create-request',
      },
    });

    expect(result.id).toBe(CHAPTER_ID);
  });

  it('cho phép tạo draft chưa có nội dung', async () => {
    persistence.createDraft.mockResolvedValue({
      status: 'created',
      chapter: createChapterRecord({ content: '', wordCount: 0 }),
    });

    await handler.execute(
      new CreateAuthorChapterCommand(
        USER_ID,
        STORY_ID,
        'Chương Một',
        undefined,
        undefined,
        undefined,
        undefined,
      ),
    );

    expect(persistence.createDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        content: '',
        wordCount: 0,
      }),
    );
  });

  it('ẩn story không tồn tại hoặc không thuộc author bằng not found', async () => {
    persistence.createDraft.mockResolvedValue({
      status: 'story_not_found',
    });

    await expect(
      handler.execute(createCommand(USER_ID)),
    ).rejects.toBeInstanceOf(StoryNotFoundException);
  });
});

function createCommand(userId: string | undefined): CreateAuthorChapterCommand {
  return new CreateAuthorChapterCommand(
    userId,
    STORY_ID,
    'Chương Một',
    'Nội dung',
    undefined,
    undefined,
    undefined,
  );
}

function createChapterRecord(
  overrides: Partial<ReturnType<typeof baseChapterRecord>> = {},
) {
  return {
    ...baseChapterRecord(),
    ...overrides,
  };
}

function baseChapterRecord() {
  const now = new Date('2026-08-15T00:00:00.000Z');

  return {
    id: CHAPTER_ID,
    storyId: STORY_ID,
    createdById: USER_ID,
    updatedById: USER_ID,
    number: 1,
    title: 'Chương Một',
    slug: 'chuong-1-chuong-mot',
    content: 'Nội dung',
    contentFormat: 'MARKDOWN',
    status: 'DRAFT',
    wordCount: 2,
    version: 1,
    scheduledAt: null,
    publishedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}
