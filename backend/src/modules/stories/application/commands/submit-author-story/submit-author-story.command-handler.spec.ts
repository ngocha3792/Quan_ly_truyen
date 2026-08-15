import {
  StoryNotReadyForReviewException,
  StorySubmissionAlreadyPendingException,
} from '../../../domain';
import { SubmitAuthorStoryCommand } from './submit-author-story.command';
import { SubmitAuthorStoryCommandHandler } from './submit-author-story.command-handler';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const STORY_ID = '22222222-2222-4222-8222-222222222222';

describe('SubmitAuthorStoryCommandHandler', () => {
  let persistence: { submitForReview: jest.Mock; };
  let handler: SubmitAuthorStoryCommandHandler;

  beforeEach(() => {
    persistence = { submitForReview: jest.fn() };
    handler = new SubmitAuthorStoryCommandHandler(persistence as never);
  });

  it('trim author note và gửi audit context xuống persistence', async () => {
    persistence.submitForReview.mockResolvedValue({
      status: 'submitted',
      publication: publication(),
    });

    const result = await handler.execute(
      new SubmitAuthorStoryCommand(
        USER_ID,
        STORY_ID,
        '  Xin duyệt truyện  ',
        '127.0.0.1',
        'Jest',
        'submit-request',
      ),
    );

    expect(persistence.submitForReview).toHaveBeenCalledWith({
      userId: USER_ID,
      storyId: STORY_ID,
      authorNote: 'Xin duyệt truyện',
      submittedAt: expect.any(Date) as unknown,
      audit: {
        ipAddress: '127.0.0.1',
        userAgent: 'Jest',
        requestId: 'submit-request',
      },
    });
    expect(result.submission.status).toBe('PENDING');
  });

  it('trả lỗi rõ các điều kiện publish còn thiếu', async () => {
    persistence.submitForReview.mockResolvedValue({
      status: 'not_ready',
      missing: ['cover', 'chapter'],
    });

    await expect(handler.execute(command())).rejects.toBeInstanceOf(
      StoryNotReadyForReviewException,
    );
  });

  it('không cho tạo pending submission thứ hai', async () => {
    persistence.submitForReview.mockResolvedValue({ status: 'already_pending' });

    await expect(handler.execute(command())).rejects.toBeInstanceOf(
      StorySubmissionAlreadyPendingException,
    );
  });
});

function command() {
  return new SubmitAuthorStoryCommand(
    USER_ID,
    STORY_ID,
    undefined,
    undefined,
    undefined,
    undefined,
  );
}

function publication() {
  const now = new Date('2026-08-15T00:00:00.000Z');
  return {
    story: {
      id: STORY_ID,
      authorId: USER_ID,
      title: 'Truyện',
      slug: 'truyen',
      synopsis: 'Mô tả',
      languageCode: 'vi',
      status: 'PENDING_REVIEW',
      visibility: 'PRIVATE',
      contentRating: 'TEEN',
      coverMediaId: '33333333-3333-4333-8333-333333333333',
      publishedAt: null,
      categories: [],
      tags: [],
      version: 2,
      createdAt: now,
      updatedAt: now,
    },
    submission: {
      id: '44444444-4444-4444-8444-444444444444',
      storyId: STORY_ID,
      submittedById: USER_ID,
      reviewedById: null,
      status: 'PENDING',
      authorNote: null,
      reviewerNote: null,
      submittedAt: now,
      reviewedAt: null,
      canceledAt: null,
    },
  };
}
