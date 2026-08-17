import { Inject, Injectable } from '@nestjs/common';
import {
  InvalidInputException,
  ResourceConflictException,
} from '@/common/exceptions';
import {
  FOLLOW_REPOSITORY,
  type FollowRepositoryPort,
} from './ports/follow.repository.port';
import type { ListFollowingInput } from './follow.models';

@Injectable()
export class FollowsService {
  constructor(
    @Inject(FOLLOW_REPOSITORY) private readonly repository: FollowRepositoryPort,
  ) {}

  follow(userId: string, authorId: string) {
    if (userId === authorId) {
      throw new ResourceConflictException({
        code: 'AUTHOR_SELF_FOLLOW_NOT_ALLOWED',
        message: 'Bạn không thể theo dõi chính mình',
      });
    }
    return this.repository.follow(userId, authorId);
  }

  unfollow(userId: string, authorId: string) {
    return this.repository.unfollow(userId, authorId);
  }

  list(input: ListFollowingInput) {
    const page = Math.max(1, input.page);
    const pageSize = Math.min(Math.max(input.pageSize, 1), 100);
    const authorIds = input.authorIds?.length
      ? [...new Set(input.authorIds)]
      : undefined;
    if (authorIds && authorIds.length > 50) {
      throw new InvalidInputException({
        code: 'FOLLOW_AUTHOR_IDS_LIMIT_EXCEEDED',
        message: 'Chỉ được kiểm tra tối đa 50 tác giả mỗi lần',
      });
    }
    return this.repository.list({ ...input, page, pageSize, authorIds });
  }
}
