import { Inject, Injectable } from '@nestjs/common';

import { AuthenticationRequiredException } from '@/common/exceptions';
import { isUuidV4 } from '@/common/utils';

import {
  ChapterContentValueObject,
  ChapterDraftOnlyMutationException,
  ChapterStoryPendingReviewException,
  ChapterNotFoundException,
  ChapterTitleValueObject,
  countChapterWords,
} from '../../../domain';
import type { ChapterResultDto } from '../../dto';
import { ChapterResultMapper } from '../../mappers';
import {
  CHAPTER_PERSISTENCE_PORT,
  type ChapterPersistencePort,
} from '../../ports';
import { UpdateAuthorChapterCommand } from './update-author-chapter.command';

@Injectable()
export class UpdateAuthorChapterCommandHandler {
  constructor(
    @Inject(CHAPTER_PERSISTENCE_PORT)
    private readonly persistence: ChapterPersistencePort,
  ) {}

  async execute(
    command: UpdateAuthorChapterCommand,
  ): Promise<ChapterResultDto> {
    const userId = requireAuthorUserId(command.userId);
    const title =
      command.title === undefined
        ? undefined
        : ChapterTitleValueObject.create(command.title).value;
    const content =
      command.content === undefined
        ? undefined
        : ChapterContentValueObject.create(command.content).value;

    const result = await this.persistence.updateDraft({
      userId,
      storyId: command.storyId,
      chapterId: command.chapterId,
      title,
      content,
      wordCount: content === undefined ? undefined : countChapterWords(content),
      updatedAt: new Date(),
      audit: {
        ipAddress: command.ipAddress,
        userAgent: command.userAgent,
        requestId: command.requestId,
      },
    });

    switch (result.status) {
      case 'updated':
        return ChapterResultMapper.toDto(result.chapter);
      case 'story_pending_review':
        throw new ChapterStoryPendingReviewException();
      case 'not_draft':
        throw new ChapterDraftOnlyMutationException();
      case 'not_found':
      default:
        throw new ChapterNotFoundException(command.chapterId);
    }
  }
}

function requireAuthorUserId(userId: string | undefined): string {
  if (!userId || !isUuidV4(userId)) {
    throw new AuthenticationRequiredException({
      code: 'CHAPTER_AUTHENTICATION_REQUIRED',
      message: 'Bạn cần đăng nhập bằng tài khoản tác giả để quản lý chương',
    });
  }

  return userId;
}
