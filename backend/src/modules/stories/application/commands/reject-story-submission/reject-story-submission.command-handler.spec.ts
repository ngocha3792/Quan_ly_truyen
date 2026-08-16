import { StorySubmissionNotPendingException } from '../../../domain';
import { RejectStorySubmissionCommand } from './reject-story-submission.command';
import { RejectStorySubmissionCommandHandler } from './reject-story-submission.command-handler';

const REVIEWER_ID = '11111111-1111-4111-8111-111111111111';
const SUBMISSION_ID = '22222222-2222-4222-8222-222222222222';

describe('RejectStorySubmissionCommandHandler', () => {
  it('gửi reviewer note đã trim xuống persistence', async () => {
    const persistence = {
      rejectSubmission: jest.fn().mockResolvedValue({
        status: 'rejected',
        publication: { story: {}, submission: {} },
      }),
    };
    const handler = new RejectStorySubmissionCommandHandler(
      persistence as never,
    );
    await handler.execute(
      new RejectStorySubmissionCommand(
        REVIEWER_ID,
        SUBMISSION_ID,
        '  Nội dung chưa đạt yêu cầu  ',
        undefined,
        undefined,
        undefined,
      ),
    );
    expect(persistence.rejectSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        reviewerId: REVIEWER_ID,
        submissionId: SUBMISSION_ID,
        reviewerNote: 'Nội dung chưa đạt yêu cầu',
      }),
    );
  });

  it('chặn review lại submission đã hoàn tất', async () => {
    const persistence = {
      rejectSubmission: jest.fn().mockResolvedValue({ status: 'not_pending' }),
    };
    const handler = new RejectStorySubmissionCommandHandler(
      persistence as never,
    );
    await expect(
      handler.execute(
        new RejectStorySubmissionCommand(
          REVIEWER_ID,
          SUBMISSION_ID,
          'Nội dung chưa đạt yêu cầu',
          undefined,
          undefined,
          undefined,
        ),
      ),
    ).rejects.toBeInstanceOf(StorySubmissionNotPendingException);
  });
});
