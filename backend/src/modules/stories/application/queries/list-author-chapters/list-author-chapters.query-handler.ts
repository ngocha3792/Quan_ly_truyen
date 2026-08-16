import { Inject, Injectable } from '@nestjs/common';

import { AuthenticationRequiredException } from '@/common/exceptions';
import { isUuidV4 } from '@/common/utils';

import { StoryNotFoundException } from '../../../domain';
import type { ChapterSummaryResultDto } from '../../dto';
import { ChapterSummaryResultMapper } from '../../mappers';
import {
  CHAPTER_PERSISTENCE_PORT,
  type ChapterPersistencePort,
} from '../../ports';
import { ListAuthorChaptersQuery } from './list-author-chapters.query';

@Injectable()
export class ListAuthorChaptersQueryHandler {
  constructor(
    @Inject(CHAPTER_PERSISTENCE_PORT)
    private readonly persistence: ChapterPersistencePort,
  ) {}

  async execute(
    query: ListAuthorChaptersQuery,
  ): Promise<readonly ChapterSummaryResultDto[]> {
    const userId = requireAuthorUserId(query.userId);
    const result = await this.persistence.listOwnedByStory(
      userId,
      query.storyId,
    );

    if (result === null) {
      throw new StoryNotFoundException(query.storyId);
    }

    return result.map((chapter) => ChapterSummaryResultMapper.toDto(chapter));
  }
}

function requireAuthorUserId(userId: string | undefined): string {
  if (!userId || !isUuidV4(userId)) {
    throw new AuthenticationRequiredException({
      code: 'CHAPTER_AUTHENTICATION_REQUIRED',
      message:
        'Bạn cần đăng nhập bằng tài khoản tác giả để xem chương của mình',
    });
  }

  return userId;
}
