import { Inject, Injectable } from '@nestjs/common';

import { AuthenticationRequiredException } from '@/common/exceptions';
import { isUuidV4 } from '@/common/utils';

import {
  ChapterDraftOnlyMutationException,
  ChapterNotFoundException,
  ChapterStoryPendingReviewException,
  ChapterVersionNotFoundException,
  ChapterVersionConflictException,
} from '../../../domain';
import type { ChapterResultDto } from '../../dto';
import { ChapterResultMapper } from '../../mappers';
import {
  CHAPTER_PERSISTENCE_PORT,
  type ChapterPersistencePort,
} from '../../ports';
import { RestoreAuthorChapterVersionCommand } from './restore-author-chapter-version.command';

@Injectable()
export class RestoreAuthorChapterVersionCommandHandler {
  constructor(
    @Inject(CHAPTER_PERSISTENCE_PORT)
    private readonly persistence: ChapterPersistencePort,
  ) {}

  async execute(
    command: RestoreAuthorChapterVersionCommand,
  ): Promise<ChapterResultDto> {
    const userId = requireAuthorUserId(command.userId);
    const result = await this.persistence.restoreDraftVersion({
      userId,
      storyId: command.storyId,
      chapterId: command.chapterId,
      version: command.version,
      expectedVersion: command.expectedVersion,
      restoredAt: new Date(),
      audit: {
        ipAddress: command.ipAddress,
        userAgent: command.userAgent,
        requestId: command.requestId,
      },
    });

    switch (result.status) {
      case 'version_conflict':
        throw new ChapterVersionConflictException(result.currentVersion);
      case 'restored':
        return ChapterResultMapper.toDto(result.chapter);
      case 'story_pending_review':
        throw new ChapterStoryPendingReviewException();
      case 'not_draft':
        throw new ChapterDraftOnlyMutationException();
      case 'version_not_found':
        throw new ChapterVersionNotFoundException(
          command.chapterId,
          command.version,
        );
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
      message: 'Bạn cần đăng nhập bằng tài khoản tác giả để khôi phục chương',
    });
  }

  return userId;
}
