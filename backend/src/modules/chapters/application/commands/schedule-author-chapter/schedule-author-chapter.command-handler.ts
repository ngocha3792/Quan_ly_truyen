import { Inject, Injectable } from '@nestjs/common';

import { AuthenticationRequiredException } from '@/common/exceptions';
import { isUuidV4 } from '@/common/utils';

import {
  ChapterEmptyContentException,
  ChapterNotFoundException,
  ChapterNotSchedulableException,
  ChapterScheduleMustBeFutureException,
  ChapterStoryNotPublishedException,
} from '../../../domain';
import type { ChapterResultDto } from '../../dto';
import { ChapterResultMapper } from '../../mappers';
import {
  CHAPTER_PERSISTENCE_PORT,
  type ChapterPersistencePort,
} from '../../ports';
import { ScheduleAuthorChapterCommand } from './schedule-author-chapter.command';

@Injectable()
export class ScheduleAuthorChapterCommandHandler {
  constructor(
    @Inject(CHAPTER_PERSISTENCE_PORT)
    private readonly persistence: ChapterPersistencePort,
  ) {}

  async execute(
    command: ScheduleAuthorChapterCommand,
  ): Promise<ChapterResultDto> {
    const userId = requireUserId(command.userId);
    const scheduledAt = new Date(command.scheduledAt);
    const updatedAt = new Date();

    if (!Number.isFinite(scheduledAt.getTime()) || scheduledAt <= updatedAt) {
      throw new ChapterScheduleMustBeFutureException();
    }

    const result = await this.persistence.schedule({
      userId,
      storyId: command.storyId,
      chapterId: command.chapterId,
      scheduledAt,
      updatedAt,
      audit: {
        ipAddress: command.ipAddress,
        userAgent: command.userAgent,
        requestId: command.requestId,
      },
    });

    switch (result.status) {
      case 'scheduled':
        return ChapterResultMapper.toDto(result.chapter);
      case 'story_not_published':
        throw new ChapterStoryNotPublishedException();
      case 'not_schedulable':
        throw new ChapterNotSchedulableException();
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
      message: 'Bạn cần đăng nhập bằng tài khoản tác giả để lên lịch chương',
    });
  }

  return userId;
}
