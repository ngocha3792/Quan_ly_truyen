import { Inject, Injectable } from '@nestjs/common';

import { AuthenticationRequiredException } from '@/common/exceptions';
import { isUuidV4 } from '@/common/utils';

import {
  ChapterDraftOnlyMutationException,
  ChapterStoryPendingReviewException,
  ChapterNotFoundException,
} from '../../../domain';
import {
  CHAPTER_PERSISTENCE_PORT,
  type ChapterPersistencePort,
} from '../../ports';
import { DeleteAuthorChapterCommand } from './delete-author-chapter.command';

@Injectable()
export class DeleteAuthorChapterCommandHandler {
  constructor(
    @Inject(CHAPTER_PERSISTENCE_PORT)
    private readonly persistence: ChapterPersistencePort,
  ) { }

  async execute(command: DeleteAuthorChapterCommand): Promise<void> {
    const userId = requireAuthorUserId(command.userId);

    const result = await this.persistence.deleteDraft({
      userId,
      storyId: command.storyId,
      chapterId: command.chapterId,
      deletedAt: new Date(),
      audit: {
        ipAddress: command.ipAddress,
        userAgent: command.userAgent,
        requestId: command.requestId,
      },
    });

    switch (result.status) {
      case 'deleted':
        return;
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
