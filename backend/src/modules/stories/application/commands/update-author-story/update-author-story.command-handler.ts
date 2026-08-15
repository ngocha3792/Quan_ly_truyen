import { Inject, Injectable } from '@nestjs/common';

import { AuthenticationRequiredException } from '@/common/exceptions';
import { isUuidV4 } from '@/common/utils';

import {
  StoryDraftOnlyMutationException,
  StoryNotFoundException,
  StorySynopsisValueObject,
  StoryTitleValueObject,
} from '../../../domain';
import type { StoryResultDto } from '../../dto';
import { StoryResultMapper } from '../../mappers';
import {
  STORY_PERSISTENCE_PORT,
  type StoryPersistencePort,
} from '../../ports';
import { UpdateAuthorStoryCommand } from './update-author-story.command';

@Injectable()
export class UpdateAuthorStoryCommandHandler {
  constructor(
    @Inject(STORY_PERSISTENCE_PORT)
    private readonly persistence: StoryPersistencePort,
  ) {}

  async execute(command: UpdateAuthorStoryCommand): Promise<StoryResultDto> {
    const userId = requireAuthorUserId(command.userId);

    const title =
      command.title === undefined
        ? undefined
        : StoryTitleValueObject.create(command.title).value;

    const synopsis =
      command.synopsis === undefined
        ? undefined
        : StorySynopsisValueObject.create(command.synopsis).value;

    const result = await this.persistence.updateDraft({
      userId,
      storyId: command.storyId,
      title,
      synopsis,
      updatedAt: new Date(),
      audit: {
        ipAddress: command.ipAddress,
        userAgent: command.userAgent,
        requestId: command.requestId,
      },
    });

    switch (result.status) {
      case 'updated':
        return StoryResultMapper.toDto(result.story);
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
