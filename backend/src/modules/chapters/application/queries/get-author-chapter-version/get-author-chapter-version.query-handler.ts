import { Inject, Injectable } from '@nestjs/common';

import { AuthenticationRequiredException } from '@/common/exceptions';
import { isUuidV4 } from '@/common/utils';

import { ChapterVersionNotFoundException } from '../../../domain';
import type { ChapterVersionResultDto } from '../../dto';
import {
  CHAPTER_PERSISTENCE_PORT,
  type ChapterPersistencePort,
} from '../../ports';
import { GetAuthorChapterVersionQuery } from './get-author-chapter-version.query';

@Injectable()
export class GetAuthorChapterVersionQueryHandler {
  constructor(
    @Inject(CHAPTER_PERSISTENCE_PORT)
    private readonly persistence: ChapterPersistencePort,
  ) {}

  async execute(
    query: GetAuthorChapterVersionQuery,
  ): Promise<ChapterVersionResultDto> {
    const userId = requireAuthorUserId(query.userId);
    const result = await this.persistence.findOwnedVersion({
      userId,
      storyId: query.storyId,
      chapterId: query.chapterId,
      version: query.version,
    });

    if (!result) {
      throw new ChapterVersionNotFoundException(query.chapterId, query.version);
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
