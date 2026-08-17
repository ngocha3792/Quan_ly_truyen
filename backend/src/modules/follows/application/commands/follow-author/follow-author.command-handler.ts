import { Inject, Injectable } from '@nestjs/common';
import { ResourceConflictException } from '@/common/exceptions';
import { FOLLOW_REPOSITORY, type FollowRepositoryPort } from '../../ports';
import { FollowAuthorCommand } from './follow-author.command';
@Injectable()
export class FollowAuthorCommandHandler {
  constructor(@Inject(FOLLOW_REPOSITORY) private readonly repository: FollowRepositoryPort) {
  }
  execute(command: FollowAuthorCommand) {
    if (command.userId === command.authorId) throw new ResourceConflictException({ code: 'AUTHOR_SELF_FOLLOW_NOT_ALLOWED', message: 'Bạn không thể theo dõi chính mình' });
    return this.repository.follow(command.userId, command.authorId);
  }
}
