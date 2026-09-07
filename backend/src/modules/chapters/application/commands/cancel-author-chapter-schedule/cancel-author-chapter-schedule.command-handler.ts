import { Inject, Injectable } from '@nestjs/common';

import { AuthenticationRequiredException } from '@/common/exceptions';
import { isUuidV4 } from '@/common/utils';

import {
  ChapterNotFoundException,
  ChapterNotScheduledException,
} from '../../../domain';
import type { ChapterResultDto } from '../../dto';
import { ChapterResultMapper } from '../../mappers';
import {
  CHAPTER_PERSISTENCE_PORT,
  type ChapterPersistencePort,
} from '../../ports';
import { CancelAuthorChapterScheduleCommand } from './cancel-author-chapter-schedule.command';

@Injectable()
export class CancelAuthorChapterScheduleCommandHandler {
  constructor(
    @Inject(CHAPTER_PERSISTENCE_PORT)
    private readonly persistence: ChapterPersistencePort,
  ) {}

  async execute(
    command: CancelAuthorChapterScheduleCommand,
  ): Promise<ChapterResultDto> {
    const userId = requireUserId(command.userId);
    const result = await this.persistence.cancelSchedule({
      userId,
      storyId: command.storyId,
      chapterId: command.chapterId,
      canceledAt: new Date(),
      audit: {
        ipAddress: command.ipAddress,
        userAgent: command.userAgent,
        requestId: command.requestId,
      },
    });

    switch (result.status) {
      case 'canceled':
        return ChapterResultMapper.toDto(result.chapter);
      case 'not_scheduled':
        throw new ChapterNotScheduledException();
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
      message: 'Bạn cần đăng nhập bằng tài khoản tác giả để huỷ lịch chương',
    });
  }

  return userId;
}
