import { Inject, Injectable } from '@nestjs/common';
import { FOLLOW_REPOSITORY, type FollowRepositoryPort } from '../../ports';
import { FollowStoryCommand } from './follow-story.command';

@Injectable()
export class FollowStoryCommandHandler {
  constructor(
    @Inject(FOLLOW_REPOSITORY)
    private readonly repository: FollowRepositoryPort,
  ) {}

  execute(command: FollowStoryCommand) {
    return this.repository.followStory(command.userId, command.storyId);
  }
}
