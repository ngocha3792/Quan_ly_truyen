import { Inject, Injectable } from '@nestjs/common';

import { AuthenticationRequiredException } from '@/common/exceptions';
import { isUuidV4 } from '@/common/utils';

import {
  ChapterContentValueObject,
  ChapterTitleValueObject,
  countChapterWords,
  StoryNotFoundException,
} from '../../../domain';
import type { ChapterResultDto } from '../../dto';
import { ChapterResultMapper } from '../../mappers';
import {
  CHAPTER_PERSISTENCE_PORT,
  type ChapterPersistencePort,
} from '../../ports';
import { CreateAuthorChapterCommand } from './create-author-chapter.command';

@Injectable()
export class CreateAuthorChapterCommandHandler {
  constructor(
    @Inject(CHAPTER_PERSISTENCE_PORT)
    private readonly persistence: ChapterPersistencePort,
  ) {}

  async execute(command: CreateAuthorChapterCommand): Promise<ChapterResultDto> {
    const userId = requireAuthorUserId(command.userId);
    const title = ChapterTitleValueObject.create(command.title).value;
    const content = ChapterContentValueObject.create(command.content).value;

    const result = await this.persistence.createDraft({
      userId,
      storyId: command.storyId,
      title,
      content,
      wordCount: countChapterWords(content),
      createdAt: new Date(),
      audit: {
        ipAddress: command.ipAddress,
        userAgent: command.userAgent,
        requestId: command.requestId,
      },
    });

    switch (result.status) {
      case 'created':
        return ChapterResultMapper.toDto(result.chapter);
      case 'story_not_found':
      default:
        throw new StoryNotFoundException(command.storyId);
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
