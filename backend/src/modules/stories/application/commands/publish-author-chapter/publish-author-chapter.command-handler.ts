import { Inject, Injectable } from '@nestjs/common';

import { AuthenticationRequiredException } from '@/common/exceptions';
import { isUuidV4 } from '@/common/utils';

import {
  ChapterEmptyContentException,
  ChapterNotFoundException,
  ChapterNotPublishableException,
  ChapterStoryNotPublishedException,
} from '../../../domain';
import { ChapterResultMapper } from '../../mappers';
import {
  CHAPTER_PERSISTENCE_PORT,
  type ChapterPersistencePort,
} from '../../ports';
import { PublishAuthorChapterCommand } from './publish-author-chapter.command';

@Injectable()
export class PublishAuthorChapterCommandHandler {
  constructor(
    @Inject(CHAPTER_PERSISTENCE_PORT)
    private readonly persistence: ChapterPersistencePort,
  ) {}

  async execute(command: PublishAuthorChapterCommand) {
    const userId = requireUserId(command.userId);
    const result = await this.persistence.publish({
      userId,
      storyId: command.storyId,
      chapterId: command.chapterId,
      publishedAt: new Date(),
      audit: {
        ipAddress: command.ipAddress,
        userAgent: command.userAgent,
        requestId: command.requestId,
      },
    });

    switch (result.status) {
      case 'published':
        return ChapterResultMapper.toDto(result.chapter);
      case 'story_not_published':
        throw new ChapterStoryNotPublishedException();
      case 'not_draft':
        throw new ChapterNotPublishableException();
      case 'empty_content':
        throw new ChapterEmptyContentException();
      case 'not_found':
      default:
        throw new ChapterNotFoundException(command.chapterId);
    }
  }
}

function requireUserId(userId: string | undefined): string {
  if (!userId || !isUuidV4(userId)) {
    throw new AuthenticationRequiredException({
      code: 'CHAPTER_AUTHENTICATION_REQUIRED',
      message: 'Bạn cần đăng nhập bằng tài khoản tác giả để xuất bản chương',
    });
  }

  return userId;
}
