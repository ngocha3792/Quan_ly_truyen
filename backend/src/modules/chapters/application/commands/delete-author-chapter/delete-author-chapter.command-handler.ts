import { Inject, Injectable } from '@nestjs/common';

import { AuthenticationRequiredException } from '@/common/exceptions';
import { isUuidV4 } from '@/common/utils';
import {
  RefundChapterPurchasesCommand,
  RefundChapterPurchasesCommandHandler,
} from '@/modules/monetization';

import {
  ChapterStoryPendingReviewException,
  ChapterNotFoundException,
} from '../../../domain';
import {
  CHAPTER_PERSISTENCE_PORT,
  type ChapterPersistencePort,
} from '../../ports';
import { DeleteAuthorChapterCommand } from './delete-author-chapter.command';

/** Lý do ghi vào sổ hoàn tiền và audit log của từng giao dịch được trả lại. */
const REFUND_REASON = 'Tác giả đã xoá chương này';

@Injectable()
export class DeleteAuthorChapterCommandHandler {
  constructor(
    @Inject(CHAPTER_PERSISTENCE_PORT)
    private readonly persistence: ChapterPersistencePort,
    private readonly refunds: RefundChapterPurchasesCommandHandler,
  ) {}

  /**
   * Xoá chương ở bất kỳ trạng thái nào, hoàn tiền mọi lượt mua trước khi xoá.
   */
  async execute(command: DeleteAuthorChapterCommand): Promise<void> {
    const userId = requireAuthorUserId(command.userId);

    /*
     * Xác minh quyền sở hữu TRƯỚC khi hoàn tiền. Đảo thứ tự lại là người lạ
     * gọi được lệnh hoàn tiền trên chương của tác giả khác.
     */
    const chapter = await this.persistence.findOwnedById(
      userId,
      command.storyId,
      command.chapterId,
    );

    if (!chapter) {
      throw new ChapterNotFoundException(command.chapterId);
    }

    /*
     * Hoàn trước, xoá sau. Hoàn xong mà xoá hỏng thì gọi lại là xong vì hoàn
     * tiền có khoá trùng lặp; còn xoá xong mà hoàn hỏng thì người đọc mất cả
     * tiền lẫn chương.
     */
    await this.refunds.execute(
      new RefundChapterPurchasesCommand(
        userId,
        { chapterId: command.chapterId },
        REFUND_REASON,
        command.ipAddress,
        command.userAgent,
        command.requestId,
      ),
    );

    const result = await this.persistence.deleteOwned({
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
