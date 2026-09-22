import { Inject, Injectable } from '@nestjs/common';

import { AuthenticationRequiredException } from '@/common/exceptions';
import { isUuidV4 } from '@/common/utils';

import {
  ChapterDraftOnlyMutationException,
  ChapterMediaReorderMismatchException,
  ChapterNotFoundException,
} from '../../../domain';
import type { ChapterMediaRecord } from '../../ports';
import {
  CHAPTER_PERSISTENCE_PORT,
  type ChapterPersistencePort,
} from '../../ports';
import { ReorderChapterMediaCommand } from './reorder-chapter-media.command';

@Injectable()
export class ReorderChapterMediaCommandHandler {
  constructor(
    @Inject(CHAPTER_PERSISTENCE_PORT)
    private readonly persistence: ChapterPersistencePort,
  ) {}

  async execute(
    command: ReorderChapterMediaCommand,
  ): Promise<readonly ChapterMediaRecord[]> {
    const userId = requireAuthorUserId(command.userId);

    const result = await this.persistence.reorderMedia({
      userId,
      storyId: command.storyId,
      chapterId: command.chapterId,
      orderedMediaAssetIds: command.orderedMediaAssetIds,
      audit: {
        ipAddress: command.ipAddress,
        userAgent: command.userAgent,
        requestId: command.requestId,
      },
    });

    switch (result.status) {
      case 'reordered':
        return result.media;
      case 'not_draft':
        throw new ChapterDraftOnlyMutationException();
      case 'mismatch':
        throw new ChapterMediaReorderMismatchException();
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
