import { StorySubmissionNotPendingException } from '../../../domain';
import { CancelAuthorStorySubmissionCommand } from './cancel-author-story-submission.command';
import { CancelAuthorStorySubmissionCommandHandler } from './cancel-author-story-submission.command-handler';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const STORY_ID = '22222222-2222-4222-8222-222222222222';

describe('CancelAuthorStorySubmissionCommandHandler', () => {
  it('chỉ cho cancel pending submission', async () => {
    const persistence = { cancelSubmission: jest.fn().mockResolvedValue({ status: 'not_pending' }) };
    const handler = new CancelAuthorStorySubmissionCommandHandler(persistence as never);
    await expect(handler.execute(new CancelAuthorStorySubmissionCommand(USER_ID, STORY_ID, undefined, undefined, undefined))).rejects.toBeInstanceOf(StorySubmissionNotPendingException);
  });
});
