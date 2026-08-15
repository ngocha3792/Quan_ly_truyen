import { Inject, Injectable } from '@nestjs/common';

import { AuthenticationRequiredException } from '@/common/exceptions';
import { isUuidV4 } from '@/common/utils';

import {
  StoryNotFoundException,
  StoryNotReadyForReviewException,
  StoryNotSubmittableException,
  StorySubmissionAlreadyPendingException,
} from '../../../domain';
import {
  STORY_PERSISTENCE_PORT,
  type StoryPersistencePort,
} from '../../ports';
import { SubmitAuthorStoryCommand } from './submit-author-story.command';

@Injectable()
export class SubmitAuthorStoryCommandHandler {
  constructor(
    @Inject(STORY_PERSISTENCE_PORT)
    private readonly persistence: StoryPersistencePort,
  ) {}

  async execute(command: SubmitAuthorStoryCommand) {
    const userId = requireUserId(command.userId);
    const authorNote = command.authorNote?.trim() || undefined;
    const result = await this.persistence.submitForReview({
      userId,
      storyId: command.storyId,
      authorNote,
      submittedAt: new Date(),
      audit: {
        ipAddress: command.ipAddress,
        userAgent: command.userAgent,
        requestId: command.requestId,
      },
    });

    switch (result.status) {
      case 'submitted':
        return result.publication;
      case 'not_draft':
        throw new StoryNotSubmittableException();
      case 'already_pending':
        throw new StorySubmissionAlreadyPendingException();
      case 'not_ready':
        throw new StoryNotReadyForReviewException(result.missing);
      case 'not_found':
      default:
        throw new StoryNotFoundException(command.storyId);
    }
  }
}

function requireUserId(userId: string | undefined): string {
  if (!userId || !isUuidV4(userId)) {
    throw new AuthenticationRequiredException({
      code: 'STORY_AUTHENTICATION_REQUIRED',
      message: 'Bạn cần đăng nhập bằng tài khoản tác giả để gửi truyện duyệt',
    });
  }

  return userId;
}
