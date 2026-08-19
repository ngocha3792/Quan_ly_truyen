import { Inject, Injectable } from '@nestjs/common';
import { InvalidInputException } from '@/common/exceptions';
import { FOLLOW_REPOSITORY, type FollowRepositoryPort } from '../../ports';
import { ListFollowingQuery } from './list-following.query';
@Injectable()
export class ListFollowingQueryHandler {
  constructor(
    @Inject(FOLLOW_REPOSITORY)
    private readonly repository: FollowRepositoryPort,
  ) {}
  execute(query: ListFollowingQuery) {
    const page = Math.max(1, query.input.page);
    const pageSize = Math.min(Math.max(query.input.pageSize, 1), 100);
    const authorIds = query.input.authorIds?.length
      ? [...new Set(query.input.authorIds)]
      : undefined;
    if (authorIds && authorIds.length > 50)
      throw new InvalidInputException({
        code: 'FOLLOW_AUTHOR_IDS_LIMIT_EXCEEDED',
        message: 'Chỉ được kiểm tra tối đa 50 tác giả mỗi lần',
      });
    return this.repository.list({ ...query.input, page, pageSize, authorIds });
  }
}
