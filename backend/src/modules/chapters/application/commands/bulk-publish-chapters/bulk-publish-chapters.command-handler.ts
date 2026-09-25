import { Inject, Injectable } from '@nestjs/common';

import { AuthenticationRequiredException } from '@/common/exceptions';
import { isUuidV4 } from '@/common/utils';

import type { BulkChapterActionResultDto } from '../../dto';
import { ChapterResultMapper } from '../../mappers';
import {
  CHAPTER_PERSISTENCE_PORT,
  type ChapterPersistencePort,
} from '../../ports';
import { BulkPublishChaptersCommand } from './bulk-publish-chapters.command';

@Injectable()
export class BulkPublishChaptersCommandHandler {
  constructor(
    @Inject(CHAPTER_PERSISTENCE_PORT)
    private readonly persistence: ChapterPersistencePort,
  ) {}

  async execute(
    command: BulkPublishChaptersCommand,
  ): Promise<BulkChapterActionResultDto> {
    const userId = requireUserId(command.userId);
    const result = await this.persistence.publishMany({
      userId,
      storyId: command.storyId,
      publishedAt: new Date(),
      audit: {
        ipAddress: command.ipAddress,
        userAgent: command.userAgent,
        requestId: command.requestId,
      },
    });

    return {
      changed: result.published.map((chapter) =>
        ChapterResultMapper.toDto(chapter),
      ),
      skipped: result.skipped.map((chapter) => ({
        chapterId: chapter.chapterId,
        number: chapter.number,
        title: chapter.title,
        ...describePublishSkip(chapter.status),
      })),
      remaining: result.remaining,
    };
  }
}

/**
 * Lý do một chương không lên bài được, viết cho tác giả đọc.
 *
 * `publish` trả trạng thái chứ không ném lỗi, nên câu giải thích phải dựng ở
 * đây thay vì lấy từ exception như lô duyệt.
 */
function describePublishSkip(status: string): {
  readonly code: string;
  readonly message: string;
} {
  if (status === 'empty_content')
    return {
      code: 'CHAPTER_EMPTY_CONTENT',
      message: 'Chương chưa có chữ nào và cũng chưa có trang ảnh nào',
    };

  if (status === 'story_not_published')
    return {
      code: 'CHAPTER_STORY_NOT_PUBLISHED',
      message: 'Truyện chưa xuất bản nên chương chưa lên bài được',
    };

  if (status === 'not_draft')
    return {
      code: 'CHAPTER_NOT_PUBLISHABLE',
      message: 'Trạng thái chương đã thay đổi trong lúc đang xử lô',
    };

  return {
    code: 'CHAPTER_NOT_FOUND',
    message: 'Không tìm thấy chương này nữa',
  };
}

function requireUserId(userId: string | undefined): string {
  if (!userId || !isUuidV4(userId)) {
    throw new AuthenticationRequiredException({
      code: 'CHAPTER_AUTHENTICATION_REQUIRED',
      message: 'Bạn cần đăng nhập để dùng thao tác hàng loạt',
    });
  }

  return userId;
}
