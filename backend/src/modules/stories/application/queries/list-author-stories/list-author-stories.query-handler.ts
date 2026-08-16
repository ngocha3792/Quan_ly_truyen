import { Inject, Injectable } from '@nestjs/common';

import { AuthenticationRequiredException } from '@/common/exceptions';
import { isUuidV4 } from '@/common/utils';

import type { StoryResultDto } from '../../dto';
import { StoryResultMapper } from '../../mappers';
import { STORY_PERSISTENCE_PORT, type StoryPersistencePort } from '../../ports';
import { ListAuthorStoriesQuery } from './list-author-stories.query';

@Injectable()
export class ListAuthorStoriesQueryHandler {
  constructor(
    @Inject(STORY_PERSISTENCE_PORT)
    private readonly persistence: StoryPersistencePort,
  ) {}

  async execute(
    query: ListAuthorStoriesQuery,
  ): Promise<readonly StoryResultDto[]> {
    const userId = requireAuthorUserId(query.userId);
    const stories = await this.persistence.listOwned(userId);

    return stories.map((story) => StoryResultMapper.toDto(story));
  }
}

function requireAuthorUserId(userId: string | undefined): string {
  if (!userId || !isUuidV4(userId)) {
    throw new AuthenticationRequiredException({
      code: 'STORY_AUTHENTICATION_REQUIRED',
      message:
        'Bạn cần đăng nhập bằng tài khoản tác giả để xem truyện của mình',
    });
  }

  return userId;
}
