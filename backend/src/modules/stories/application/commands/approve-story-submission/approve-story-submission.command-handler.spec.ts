import {
  StoryNotReadyForReviewException,
  StorySubmissionSelfReviewException,
} from '../../../domain';
import { ApproveStorySubmissionCommand } from './approve-story-submission.command';
import { ApproveStorySubmissionCommandHandler } from './approve-story-submission.command-handler';

const REVIEWER_ID = '11111111-1111-4111-8111-111111111111';
const SUBMISSION_ID = '22222222-2222-4222-8222-222222222222';

describe('ApproveStorySubmissionCommandHandler', () => {
  let persistence: { approveSubmission: jest.Mock; };
  let handler: ApproveStorySubmissionCommandHandler;

  beforeEach(() => {
    persistence = { approveSubmission: jest.fn() };
    handler = new ApproveStorySubmissionCommandHandler(persistence as never);
  });

  it('approve submission qua persistence với review audit', async () => {
    persistence.approveSubmission.mockResolvedValue({
      status: 'approved',
      publication: { story: { status: 'PUBLISHED' }, submission: { status: 'APPROVED' } },
    });

    const result = await handler.execute(
      new ApproveStorySubmissionCommand(
        REVIEWER_ID,
        SUBMISSION_ID,
        '127.0.0.1',
        'Jest',
        'approve-request',
      ),
    );

    expect(persistence.approveSubmission).toHaveBeenCalledWith({
      reviewerId: REVIEWER_ID,
      submissionId: SUBMISSION_ID,
      reviewedAt: expect.any(Date) as unknown,
      audit: {
        ipAddress: '127.0.0.1',
        userAgent: 'Jest',
        requestId: 'approve-request',
      },
    });
    expect(result.story.status).toBe('PUBLISHED');
  });

  it('chặn self review', async () => {
    persistence.approveSubmission.mockResolvedValue({ status: 'self_review' });
    await expect(handler.execute(command())).rejects.toBeInstanceOf(
      StorySubmissionSelfReviewException,
    );
  });

  it('revalidate publication readiness ngay trước approve', async () => {
    persistence.approveSubmission.mockResolvedValue({
      status: 'not_ready',
      missing: ['cover'],
    });
    await expect(handler.execute(command())).rejects.toBeInstanceOf(
      StoryNotReadyForReviewException,
    );
  });
});

function command() {
  return new ApproveStorySubmissionCommand(
    REVIEWER_ID,
    SUBMISSION_ID,
    undefined,
    undefined,
    undefined,
  );
}
