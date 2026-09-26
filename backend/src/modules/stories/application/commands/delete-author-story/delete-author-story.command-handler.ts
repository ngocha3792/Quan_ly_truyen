import { Inject, Injectable } from '@nestjs/common';

import { AuthenticationRequiredException } from '@/common/exceptions';
import { isUuidV4 } from '@/common/utils';
import {
  RefundChapterPurchasesCommand,
  RefundChapterPurchasesCommandHandler,
} from '@/modules/monetization';

import {
  StoryNotFoundException,
  StoryPendingReviewDeletionException,
} from '../../../domain';
import { STORY_PERSISTENCE_PORT, type StoryPersistencePort } from '../../ports';
import { DeleteAuthorStoryCommand } from './delete-author-story.command';

/** Lý do ghi vào sổ hoàn tiền và audit log của từng giao dịch được trả lại. */
const REFUND_REASON = 'Tác giả đã xoá truyện này';

@Injectable()
export class DeleteAuthorStoryCommandHandler {
  constructor(
    @Inject(STORY_PERSISTENCE_PORT)
    private readonly persistence: StoryPersistencePort,
    private readonly refunds: RefundChapterPurchasesCommandHandler,
  ) {}

  /**
   * Xoá truyện ở bất kỳ trạng thái nào, hoàn tiền mọi lượt mua chương trước.
   */
  async execute(command: DeleteAuthorStoryCommand): Promise<void> {
    const userId = requireAuthorUserId(command.userId);

    /*
     * Xác minh quyền sở hữu TRƯỚC khi hoàn tiền. Đảo thứ tự lại là người lạ
     * gọi được lệnh hoàn tiền trên truyện của tác giả khác.
     */
    const story = await this.persistence.findOwnedById(userId, command.storyId);

    if (!story) {
      throw new StoryNotFoundException(command.storyId);
    }

    /*
     * Hoàn trước, xoá sau. Hoàn xong mà xoá hỏng thì gọi lại là xong vì hoàn
     * tiền có khoá trùng lặp; còn xoá xong mà hoàn hỏng thì người đọc mất cả
     * tiền lẫn truyện.
     */
    await this.refunds.execute(
      new RefundChapterPurchasesCommand(
        userId,
        { storyId: command.storyId },
        REFUND_REASON,
        command.ipAddress,
        command.userAgent,
        command.requestId,
      ),
    );

    const result = await this.persistence.deleteOwned({
      userId,
      storyId: command.storyId,
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
        throw new StoryPendingReviewDeletionException();
      case 'not_found':
      default:
        throw new StoryNotFoundException(command.storyId);
    }
  }
}

function requireAuthorUserId(userId: string | undefined): string {
  if (!userId || !isUuidV4(userId)) {
    throw new AuthenticationRequiredException({
      code: 'STORY_AUTHENTICATION_REQUIRED',
      message: 'Bạn cần đăng nhập bằng tài khoản tác giả để quản lý truyện',
    });
  }

  return userId;
}
