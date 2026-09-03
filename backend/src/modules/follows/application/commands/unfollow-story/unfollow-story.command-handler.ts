import { Inject, Injectable } from '@nestjs/common';
import { FOLLOW_REPOSITORY, type FollowRepositoryPort } from '../../ports';
import { UnfollowStoryCommand } from './unfollow-story.command';

@Injectable()
export class UnfollowStoryCommandHandler {
  constructor(
    @Inject(FOLLOW_REPOSITORY)
    private readonly repository: FollowRepositoryPort,
  ) {}

  execute(command: UnfollowStoryCommand) {
    return this.repository.unfollowStory(command.userId, command.storyId);
  }
}
