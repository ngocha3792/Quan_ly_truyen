import { Inject, Injectable } from '@nestjs/common';

import { AuthenticationRequiredException } from '@/common/exceptions';
import { isUuidV4 } from '@/common/utils';

import {
  StoryNotReadyForReviewException,
  StorySubmissionNotFoundException,
  StorySubmissionNotPendingException,
  StorySubmissionSelfReviewException,
} from '../../../domain';
import {
  STORY_PERSISTENCE_PORT,
  type StoryPersistencePort,
} from '../../ports';
import { ApproveStorySubmissionCommand } from './approve-story-submission.command';

@Injectable()
export class ApproveStorySubmissionCommandHandler {
  constructor(
    @Inject(STORY_PERSISTENCE_PORT)
    private readonly persistence: StoryPersistencePort,
  ) {}

  async execute(command: ApproveStorySubmissionCommand) {
    const reviewerId = requireReviewerId(command.reviewerId);
    const result = await this.persistence.approveSubmission({
      reviewerId,
      submissionId: command.submissionId,
      reviewedAt: new Date(),
      audit: {
        ipAddress: command.ipAddress,
        userAgent: command.userAgent,
        requestId: command.requestId,
      },
    });

    switch (result.status) {
      case 'approved':
        return result.publication;
      case 'self_review':
        throw new StorySubmissionSelfReviewException();
      case 'not_pending':
        throw new StorySubmissionNotPendingException();
      case 'not_ready':
        throw new StoryNotReadyForReviewException(result.missing);
      case 'not_found':
      default:
        throw new StorySubmissionNotFoundException(command.submissionId);
    }
  }
}

function requireReviewerId(userId: string | undefined): string {
  if (!userId || !isUuidV4(userId)) {
    throw new AuthenticationRequiredException({
      code: 'STORY_REVIEW_AUTHENTICATION_REQUIRED',
      message: 'Bạn cần đăng nhập để duyệt truyện',
    });
  }

  return userId;
}
