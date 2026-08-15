import { Inject, Injectable } from '@nestjs/common';

import { AuthenticationRequiredException } from '@/common/exceptions';
import { isUuidV4 } from '@/common/utils';

import {
  StoryDraftOnlyMutationException,
  StoryNotFoundException,
} from '../../../domain';
import {
  STORY_PERSISTENCE_PORT,
  type StoryPersistencePort,
} from '../../ports';
import { DeleteAuthorStoryCommand } from './delete-author-story.command';

@Injectable()
export class DeleteAuthorStoryCommandHandler {
  constructor(
    @Inject(STORY_PERSISTENCE_PORT)
    private readonly persistence: StoryPersistencePort,
  ) {}

  async execute(command: DeleteAuthorStoryCommand): Promise<void> {
    const userId = requireAuthorUserId(command.userId);

    const result = await this.persistence.deleteDraft({
      userId,
      storyId: command.storyId,
      deletedAt: new Date(),
      audit: {
        ipAddress: command.ipAddress,
        userAgent: command.userAgent,
        requestId: command.requestId,
      },
    });

    switch (result.status) {
      case 'deleted':
        return;
      case 'not_draft':
        throw new StoryDraftOnlyMutationException();
      case 'not_found':
      default:
        throw new StoryNotFoundException(command.storyId);
    }
  }
}

function requireAuthorUserId(userId: string | undefined): string {
  if (!userId || !isUuidV4(userId)) {
    throw new AuthenticationRequiredException({
      code: 'STORY_AUTHENTICATION_REQUIRED',
      message: 'Bạn cần đăng nhập bằng tài khoản tác giả để quản lý truyện',
    });
  }

  return userId;
}
