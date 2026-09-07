import { Inject, Injectable } from '@nestjs/common';

import { AuthenticationRequiredException } from '@/common/exceptions';
import { isUuidV4 } from '@/common/utils';

import { ChapterNotFoundException } from '../../../domain';
import type { ChapterVersionPageResultDto } from '../../dto';
import {
  CHAPTER_PERSISTENCE_PORT,
  type ChapterPersistencePort,
} from '../../ports';
import { ListAuthorChapterVersionsQuery } from './list-author-chapter-versions.query';

@Injectable()
export class ListAuthorChapterVersionsQueryHandler {
  constructor(
    @Inject(CHAPTER_PERSISTENCE_PORT)
    private readonly persistence: ChapterPersistencePort,
  ) {}

  async execute(
    query: ListAuthorChapterVersionsQuery,
  ): Promise<ChapterVersionPageResultDto> {
    const userId = requireAuthorUserId(query.userId);
    const result = await this.persistence.listOwnedVersions({
      userId,
      storyId: query.storyId,
      chapterId: query.chapterId,
      page: query.page,
      pageSize: query.pageSize,
    });

    if (!result) {
      throw new ChapterNotFoundException(query.chapterId);
    }

    return result;
  }
}

function requireAuthorUserId(userId: string | undefined): string {
  if (!userId || !isUuidV4(userId)) {
    throw new AuthenticationRequiredException({
      code: 'CHAPTER_AUTHENTICATION_REQUIRED',
      message: 'Bạn cần đăng nhập bằng tài khoản tác giả để xem lịch sử chương',
    });
  }

  return userId;
}
