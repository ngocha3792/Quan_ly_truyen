import { AuthenticationRequiredException } from '@/common/exceptions';

import {
  ChapterDraftOnlyMutationException,
  ChapterNotFoundException,
} from '../../../domain';
import { UpdateAuthorChapterCommand } from './update-author-chapter.command';
import { UpdateAuthorChapterCommandHandler } from './update-author-chapter.command-handler';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const STORY_ID = '22222222-2222-4222-8222-222222222222';
const CHAPTER_ID = '33333333-3333-4333-8333-333333333333';

describe('UpdateAuthorChapterCommandHandler', () => {
  let persistence: {
    updateDraft: jest.Mock;
  };

  let handler: UpdateAuthorChapterCommandHandler;

  beforeEach(() => {
    persistence = {
      updateDraft: jest.fn(),
    };

    handler = new UpdateAuthorChapterCommandHandler(persistence as never);
  });

  it('yêu cầu authenticated author UUID hợp lệ', async () => {
    await expect(
      handler.execute(createCommand(undefined)),
    ).rejects.toBeInstanceOf(AuthenticationRequiredException);

    expect(persistence.updateDraft).not.toHaveBeenCalled();
  });

  it('normalize field thay đổi và tính lại word count', async () => {
    persistence.updateDraft.mockResolvedValue({
      status: 'updated',
      chapter: createChapterRecord({
        title: 'Tiêu đề mới',
        content: 'Một hai ba',
        wordCount: 3,
        version: 2,
      }),
    });

    await handler.execute(
      new UpdateAuthorChapterCommand(
        USER_ID,
        STORY_ID,
        CHAPTER_ID,
        '  Tiêu đề    mới  ',
        'Một hai ba',
        '127.0.0.1',
        'Jest',
        'chapter-update-request',
      ),
    );

    expect(persistence.updateDraft).toHaveBeenCalledWith({
      userId: USER_ID,
      storyId: STORY_ID,
      chapterId: CHAPTER_ID,
      title: 'Tiêu đề mới',
      content: 'Một hai ba',
      wordCount: 3,
      updatedAt: expect.any(Date) as unknown,
      audit: {
        ipAddress: '127.0.0.1',
        userAgent: 'Jest',
        requestId: 'chapter-update-request',
      },
    });
  });

  it('không tính lại word count khi content không được gửi', async () => {
    persistence.updateDraft.mockResolvedValue({
      status: 'updated',
      chapter: createChapterRecord(),
    });

    await handler.execute(
      new UpdateAuthorChapterCommand(
        USER_ID,
        STORY_ID,
        CHAPTER_ID,
        'Tên khác',
        undefined,
        undefined,
        undefined,
        undefined,
      ),
    );

    expect(persistence.updateDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Tên khác',
        content: undefined,
        wordCount: undefined,
      }),
    );
  });

  it('không cho sửa chapter không còn là draft', async () => {
    persistence.updateDraft.mockResolvedValue({
      status: 'not_draft',
    });

    await expect(
      handler.execute(createCommand(USER_ID)),
    ).rejects.toBeInstanceOf(ChapterDraftOnlyMutationException);
  });

  it('ẩn chapter không tồn tại, story sai hoặc không thuộc author bằng not found', async () => {
    persistence.updateDraft.mockResolvedValue({
      status: 'not_found',
    });

    await expect(
      handler.execute(createCommand(USER_ID)),
    ).rejects.toBeInstanceOf(ChapterNotFoundException);
  });
});

function createCommand(userId: string | undefined): UpdateAuthorChapterCommand {
  return new UpdateAuthorChapterCommand(
    userId,
    STORY_ID,
    CHAPTER_ID,
    'Chương Một',
    'Nội dung mới',
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
