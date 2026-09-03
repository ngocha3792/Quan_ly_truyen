import { Inject, Injectable } from '@nestjs/common';
import { FOLLOW_REPOSITORY, type FollowRepositoryPort } from '../../ports';
import { GetStoryFollowQuery } from './get-story-follow.query';

@Injectable()
export class GetStoryFollowQueryHandler {
  constructor(
    @Inject(FOLLOW_REPOSITORY)
    private readonly repository: FollowRepositoryPort,
  ) {}

  execute(query: GetStoryFollowQuery) {
    return this.repository.getStoryFollow(query.userId, query.storyId);
  }
}
