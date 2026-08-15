import { Inject, Injectable } from '@nestjs/common';

import { AuthenticationRequiredException } from '@/common/exceptions';
import { isUuidV4 } from '@/common/utils';

import { ChapterNotFoundException } from '../../../domain';
import type { ChapterResultDto } from '../../dto';
import { ChapterResultMapper } from '../../mappers';
import { CHAPTER_PERSISTENCE_PORT, type ChapterPersistencePort } from '../../ports';
import { GetAuthorChapterQuery } from './get-author-chapter.query';

@Injectable()
export class GetAuthorChapterQueryHandler {
  constructor(
    @Inject(CHAPTER_PERSISTENCE_PORT)
    private readonly persistence: ChapterPersistencePort,
  ) {}

  async execute(query: GetAuthorChapterQuery): Promise<ChapterResultDto> {
    const userId = requireAuthorUserId(query.userId);
    const chapter = await this.persistence.findOwnedById(
      userId,
      query.storyId,
      query.chapterId,
    );

    if (!chapter) {
      throw new ChapterNotFoundException(query.chapterId);
    }

    return ChapterResultMapper.toDto(chapter);
  }
}

function requireAuthorUserId(userId: string | undefined): string {
  if (!userId || !isUuidV4(userId)) {
    throw new AuthenticationRequiredException({
      code: 'CHAPTER_AUTHENTICATION_REQUIRED',
      message: 'Bạn cần đăng nhập bằng tài khoản tác giả để xem chương của mình',
    });
  }

  return userId;
}
