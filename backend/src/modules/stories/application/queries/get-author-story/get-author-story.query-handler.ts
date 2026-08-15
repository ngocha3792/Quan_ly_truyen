import { Inject, Injectable } from '@nestjs/common';

import { AuthenticationRequiredException } from '@/common/exceptions';
import { isUuidV4 } from '@/common/utils';

import { StoryNotFoundException } from '../../../domain';
import type { StoryResultDto } from '../../dto';
import { StoryResultMapper } from '../../mappers';
import { STORY_PERSISTENCE_PORT, type StoryPersistencePort } from '../../ports';
import { GetAuthorStoryQuery } from './get-author-story.query';

@Injectable()
export class GetAuthorStoryQueryHandler {
  constructor(
    @Inject(STORY_PERSISTENCE_PORT)
    private readonly persistence: StoryPersistencePort,
  ) {}

  async execute(query: GetAuthorStoryQuery): Promise<StoryResultDto> {
    const userId = requireAuthorUserId(query.userId);
    const story = await this.persistence.findOwnedById(userId, query.storyId);

    if (!story) {
      throw new StoryNotFoundException(query.storyId);
    }

    return StoryResultMapper.toDto(story);
  }
}

function requireAuthorUserId(userId: string | undefined): string {
  if (!userId || !isUuidV4(userId)) {
    throw new AuthenticationRequiredException({
      code: 'STORY_AUTHENTICATION_REQUIRED',
      message: 'Bạn cần đăng nhập bằng tài khoản tác giả để xem truyện của mình',
    });
  }

  return userId;
}
