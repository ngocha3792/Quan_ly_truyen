import { Inject, Injectable } from '@nestjs/common';
import { InvalidInputException } from '@/common/exceptions';
import { FOLLOW_REPOSITORY, type FollowRepositoryPort } from '../../ports';
import { ListStoryFollowsQuery } from './list-story-follows.query';

@Injectable()
export class ListStoryFollowsQueryHandler {
  constructor(
    @Inject(FOLLOW_REPOSITORY)
    private readonly repository: FollowRepositoryPort,
  ) {}

  execute(query: ListStoryFollowsQuery): Promise<readonly string[]> {
    const storyIds = query.storyIds.length ? [...new Set(query.storyIds)] : [];
    if (storyIds.length > 100)
      throw new InvalidInputException({
        code: 'FOLLOW_STORY_IDS_LIMIT_EXCEEDED',
        message: 'Chỉ được kiểm tra tối đa 100 truyện mỗi lần',
      });
    return this.repository.listStoryFollows(query.userId, storyIds);
  }
}
