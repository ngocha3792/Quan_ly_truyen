import { Inject, Injectable } from '@nestjs/common';

import { AuthenticationRequiredException } from '@/common/exceptions';
import { isUuidV4 } from '@/common/utils';

import {
  AuthorProfileUnavailableException,
  InvalidStoryCategoriesException,
  InvalidStoryTagsException,
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
      categoryIds: normalizeIds(command.categoryIds),
      tagIds: normalizeIds(command.tagIds),
      createdAt: new Date(),
      audit: {
        ipAddress: command.ipAddress,
        userAgent: command.userAgent,
        requestId: command.requestId,
      },
    });

    switch (result.status) {
      case 'created':
        return StoryResultMapper.toDto(result.story);
      case 'invalid_categories':
        throw new InvalidStoryCategoriesException(result.invalidIds);
      case 'invalid_tags':
        throw new InvalidStoryTagsException(result.invalidIds);
      case 'author_not_found':
      default:
        throw new AuthorProfileUnavailableException();
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

function normalizeIds(ids: readonly string[] | undefined): readonly string[] {
  return ids ? [...new Set(ids)] : [];
}
