import { Inject, Injectable } from '@nestjs/common';

import { AuthenticationRequiredException } from '@/common/exceptions';
import { isUuidV4 } from '@/common/utils';

import {
  ChapterContentValueObject,
  ChapterImportPolicy,
  ChapterTitleValueObject,
  ChapterImportTooManyException,
  countChapterWords,
} from '../../../domain';
import type { ChapterResultDto } from '../../dto';
import { ChapterResultMapper } from '../../mappers';
import {
  CHAPTER_PERSISTENCE_PORT,
  type ChapterPersistencePort,
} from '../../ports';
import { ImportAuthorChaptersCommand } from './import-author-chapters.command';

export interface ImportAuthorChaptersResultDto {
  readonly created: readonly ChapterResultDto[];

  readonly skipped: readonly {
    readonly index: number;
    readonly title: string;
    readonly code: string;
    readonly message: string;
  }[];
}

@Injectable()
export class ImportAuthorChaptersCommandHandler {
  constructor(
    @Inject(CHAPTER_PERSISTENCE_PORT)
    private readonly persistence: ChapterPersistencePort,
  ) {}

  async execute(
    command: ImportAuthorChaptersCommand,
  ): Promise<ImportAuthorChaptersResultDto> {
    const userId = requireAuthorUserId(command.userId);

    /*
     * Giao diện đã chia bản thảo thành từng lô, nhưng máy chủ không tin vào
     * giới hạn phía giao diện: một lô quá lớn là request chết giữa đường và
     * nửa số chương nằm lại trong bảng.
     */
    if (command.chapters.length > ChapterImportPolicy.MAX_PER_CALL) {
      throw new ChapterImportTooManyException(command.chapters.length);
    }

    /*
     * Chuẩn hoá qua đúng các value object mà đường viết tay dùng, để chương
     * nhập vào không khác chương tự gõ ở chỗ nào.
     */
    const chapters = command.chapters.map((chapter) => {
      const content = ChapterContentValueObject.create(chapter.content).value;
      return {
        title: ChapterTitleValueObject.create(chapter.title).value,
        content,
        wordCount: countChapterWords(content),
      };
    });

    const result = await this.persistence.importDrafts({
      userId,
      storyId: command.storyId,
      chapters,
      createdAt: new Date(),
      audit: {
        ipAddress: command.ipAddress,
        userAgent: command.userAgent,
        requestId: command.requestId,
      },
    });

    return {
      created: result.created.map((chapter) =>
        ChapterResultMapper.toDto(chapter),
      ),
      skipped: result.skipped,
    };
  }
}

function requireAuthorUserId(userId: string | undefined): string {
  if (!userId || !isUuidV4(userId)) {
    throw new AuthenticationRequiredException({
      code: 'CHAPTER_AUTHENTICATION_REQUIRED',
      message: 'Bạn cần đăng nhập bằng tài khoản tác giả để nhập chương',
    });
  }

  return userId;
}
