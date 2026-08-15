import { Inject, Injectable } from '@nestjs/common';

import { AuthenticationRequiredException } from '@/common/exceptions';
import { isUuidV4 } from '@/common/utils';

import {
  AuthorProfileUnavailableException,
  StorySynopsisValueObject,
  StoryTitleValueObject,
} from '../../../domain';
import type { StoryResultDto } from '../../dto';
import { StoryResultMapper } from '../../mappers';
import {
  STORY_PERSISTENCE_PORT,
  type StoryPersistencePort,
} from '../../ports';
import { CreateAuthorStoryCommand } from './create-author-story.command';

@Injectable()
export class CreateAuthorStoryCommandHandler {
  constructor(
    @Inject(STORY_PERSISTENCE_PORT)
    private readonly persistence: StoryPersistencePort,
  ) {}

  async execute(command: CreateAuthorStoryCommand): Promise<StoryResultDto> {
    const userId = requireAuthorUserId(command.userId);
    const title = StoryTitleValueObject.create(command.title).value;
    const synopsis = StorySynopsisValueObject.create(command.synopsis).value;

    const result = await this.persistence.createDraft({
      userId,
      title,
      synopsis,
      createdAt: new Date(),
      audit: {
        ipAddress: command.ipAddress,
        userAgent: command.userAgent,
        requestId: command.requestId,
      },
    });

    if (result.status === 'author_not_found') {
      throw new AuthorProfileUnavailableException();
    }

    return StoryResultMapper.toDto(result.story);
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
