import { createHash } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import {
  ChapterRefundBatchPolicy,
  InvalidMonetizationInputException,
  requireMonetizationUserId,
} from '../../../domain';
import {
  MONETIZATION_PERSISTENCE_PORT,
  type MonetizationPersistencePort,
} from '../../ports';
import { RefundChapterPurchasesCommand } from './refund-chapter-purchases.command';

export interface RefundChapterPurchasesResultDto {
  /** Số giao dịch đã hoàn trong lượt này. */
  readonly refunded: number;
}

@Injectable()
export class RefundChapterPurchasesCommandHandler {
  constructor(
    @Inject(MONETIZATION_PERSISTENCE_PORT)
    private readonly persistence: MonetizationPersistencePort,
  ) {}

  /**
   * Hoàn lần lượt từng giao dịch, mỗi giao dịch một lần gọi
   * `refundChapterPurchase`.
   *
   * Gọi lại đúng đường hoàn tiền sẵn có chứ không viết lại: sổ kép, khoá ví,
   * thu hồi entitlement, đảo phần doanh thu đã chia và audit log đều phải y
   * hệt như khi quản trị bấm hoàn từng giao dịch.
   *
   * Ném lỗi nếu số giao dịch vượt trần. Gọi nơi khác phải chạy hàm này TRƯỚC
   * khi xoá nội dung: hoàn xong mà xoá hỏng thì gọi lại là xong, còn xoá xong
   * mà hoàn hỏng thì tiền nợ lại và thứ người ta mua đã biến mất.
   */
  async execute(
    command: RefundChapterPurchasesCommand,
  ): Promise<RefundChapterPurchasesResultDto> {
    const actorId = requireMonetizationUserId(command.actorId);
    const reason = command.reason.trim();

    if (!reason) {
      throw new InvalidMonetizationInputException(
        'Cần ghi lý do hoàn tiền',
        'reason',
      );
    }

    const purchases = await this.persistence.listRefundableChapterPurchases({
      ...(command.scope.chapterId
        ? { chapterId: command.scope.chapterId }
        : {}),
      ...(command.scope.storyId ? { storyId: command.scope.storyId } : {}),
      // Lấy dư một bản ghi để biết còn sót hay vừa đủ.
      limit: ChapterRefundBatchPolicy.MAX_REFUNDS_PER_DELETE + 1,
    });

    if (purchases.length > ChapterRefundBatchPolicy.MAX_REFUNDS_PER_DELETE) {
      throw new InvalidMonetizationInputException(
        `Nội dung này có hơn ${ChapterRefundBatchPolicy.MAX_REFUNDS_PER_DELETE} lượt mua cần hoàn; hãy liên hệ quản trị để xử lý`,
        'purchases',
      );
    }

    for (const purchase of purchases) {
      await this.persistence.refundChapterPurchase({
        actorId,
        purchaseId: purchase.id,
        reason,
        /*
         * Cùng công thức băm với đường hoàn từng giao dịch, nên gọi lại sau một
         * lần xoá hỏng giữa chừng sẽ trùng khớp và không hoàn hai lần.
         */
        requestHash: createHash('sha256')
          .update(JSON.stringify([purchase.id, reason, 'CHAPTER_REFUND']))
          .digest('hex'),
        ...(command.ipAddress ? { ipAddress: command.ipAddress } : {}),
        ...(command.userAgent ? { userAgent: command.userAgent } : {}),
        ...(command.requestId ? { requestId: command.requestId } : {}),
      });
    }

    return { refunded: purchases.length };
  }
}
