import { Inject, Injectable } from '@nestjs/common';

import { AuthenticationRequiredException } from '@/common/exceptions';
import { isUuidV4 } from '@/common/utils';

import {
  StoryNotFoundException,
  StorySubmissionNotPendingException,
} from '../../../domain';
import {
  STORY_PERSISTENCE_PORT,
  type StoryPersistencePort,
} from '../../ports';
import { CancelAuthorStorySubmissionCommand } from './cancel-author-story-submission.command';

@Injectable()
export class CancelAuthorStorySubmissionCommandHandler {
  constructor(
    @Inject(STORY_PERSISTENCE_PORT)
    private readonly persistence: StoryPersistencePort,
  ) {}

  async execute(command: CancelAuthorStorySubmissionCommand) {
    const userId = requireUserId(command.userId);
    const result = await this.persistence.cancelSubmission({
      userId,
      storyId: command.storyId,
      canceledAt: new Date(),
      audit: {
        ipAddress: command.ipAddress,
        userAgent: command.userAgent,
        requestId: command.requestId,
      },
    });

    switch (result.status) {
      case 'canceled':
        return result.publication;
      case 'not_pending':
        throw new StorySubmissionNotPendingException();
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
      message:
        'Bạn cần đăng nhập bằng tài khoản tác giả để quản lý yêu cầu duyệt',
    });
  }

  return userId;
}
