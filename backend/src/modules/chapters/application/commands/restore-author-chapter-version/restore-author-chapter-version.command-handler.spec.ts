import { AuthenticationRequiredException } from '@/common/exceptions';

import {
  ChapterDraftOnlyMutationException,
  ChapterNotFoundException,
  ChapterStoryPendingReviewException,
  ChapterVersionNotFoundException,
  ChapterVersionConflictException,
} from '../../../domain';
import { RestoreAuthorChapterVersionCommand } from './restore-author-chapter-version.command';
import { RestoreAuthorChapterVersionCommandHandler } from './restore-author-chapter-version.command-handler';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const STORY_ID = '22222222-2222-4222-8222-222222222222';
const CHAPTER_ID = '33333333-3333-4333-8333-333333333333';

describe('RestoreAuthorChapterVersionCommandHandler', () => {
  const persistence = { restoreDraftVersion: jest.fn() };
  const handler = new RestoreAuthorChapterVersionCommandHandler(
    persistence as never,
  );

  beforeEach(() => persistence.restoreDraftVersion.mockReset());

  it('restores an owned draft version with audit context', async () => {
    persistence.restoreDraftVersion.mockResolvedValue({
      status: 'restored',
      chapter: chapterRecord(),
    });

    await expect(handler.execute(command(USER_ID))).resolves.toMatchObject({
      id: CHAPTER_ID,
      version: 4,
      title: 'Bản đã khôi phục',
    });
    expect(persistence.restoreDraftVersion).toHaveBeenCalledWith({
      userId: USER_ID,
      storyId: STORY_ID,
      chapterId: CHAPTER_ID,
      version: 2,
      expectedVersion: undefined,
      restoredAt: expect.any(Date) as unknown,
      audit: {
        ipAddress: '127.0.0.1',
        userAgent: 'Jest',
        requestId: 'restore-request',
      },
    });
  });

  it('requires an authenticated author', async () => {
    await expect(handler.execute(command(undefined))).rejects.toBeInstanceOf(
      AuthenticationRequiredException,
    );
    expect(persistence.restoreDraftVersion).not.toHaveBeenCalled();
  });

  it('returns a conflict instead of restoring over a concurrent edit', async () => {
    persistence.restoreDraftVersion.mockResolvedValue({
      status: 'version_conflict',
      currentVersion: 6,
    });
    await expect(
      handler.execute(
        new RestoreAuthorChapterVersionCommand(
          USER_ID,
          STORY_ID,
          CHAPTER_ID,
          2,
          undefined,
          undefined,
          undefined,
          5,
        ),
      ),
    ).rejects.toBeInstanceOf(ChapterVersionConflictException);
    expect(persistence.restoreDraftVersion).toHaveBeenCalledWith(
      expect.objectContaining({ expectedVersion: 5 }),
    );
  });

  it.each([
    ['not_found', ChapterNotFoundException],
    ['version_not_found', ChapterVersionNotFoundException],
    ['not_draft', ChapterDraftOnlyMutationException],
    ['story_pending_review', ChapterStoryPendingReviewException],
  ] as const)('maps %s persistence status', async (status, errorType) => {
    persistence.restoreDraftVersion.mockResolvedValue({ status });
    await expect(handler.execute(command(USER_ID))).rejects.toBeInstanceOf(
      errorType,
    );
  });
});

function command(userId: string | undefined) {
  return new RestoreAuthorChapterVersionCommand(
    userId,
    STORY_ID,
    CHAPTER_ID,
    2,
    '127.0.0.1',
    'Jest',
    'restore-request',
  );
}

function chapterRecord() {
  const now = new Date('2026-09-07T00:00:00.000Z');
  return {
    id: CHAPTER_ID,
    storyId: STORY_ID,
    createdById: USER_ID,
    updatedById: USER_ID,
    number: 1,
    title: 'Bản đã khôi phục',
    slug: 'chuong-1-ban-da-khoi-phuc',
    content: 'Nội dung cũ',
    contentFormat: 'MARKDOWN',
    status: 'DRAFT',
    wordCount: 3,
    version: 4,
    scheduledAt: null,
    publishedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}
