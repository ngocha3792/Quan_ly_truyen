import { Inject, Injectable } from '@nestjs/common';

import { AuthenticationRequiredException } from '@/common/exceptions';
import { isUuidV4 } from '@/common/utils';

import {
  ChapterDraftOnlyMutationException,
  ChapterNotFoundException,
  InvalidChapterMediaException,
} from '../../../domain';
import type { ChapterMediaRecord } from '../../ports';
import {
  CHAPTER_PERSISTENCE_PORT,
  type ChapterPersistencePort,
} from '../../ports';
import { AttachChapterMediaCommand } from './attach-chapter-media.command';

@Injectable()
export class AttachChapterMediaCommandHandler {
  constructor(
    @Inject(CHAPTER_PERSISTENCE_PORT)
    private readonly persistence: ChapterPersistencePort,
  ) {}

  async execute(
    command: AttachChapterMediaCommand,
  ): Promise<readonly ChapterMediaRecord[]> {
    const userId = requireAuthorUserId(command.userId);

    const result = await this.persistence.attachMedia({
      userId,
      storyId: command.storyId,
      chapterId: command.chapterId,
      pages: command.pages,
      audit: {
        ipAddress: command.ipAddress,
        userAgent: command.userAgent,
        requestId: command.requestId,
      },
    });

    switch (result.status) {
      case 'attached':
        return result.media;
      case 'not_draft':
        throw new ChapterDraftOnlyMutationException();
      case 'invalid_media':
        throw new InvalidChapterMediaException(result.invalidIds);
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
