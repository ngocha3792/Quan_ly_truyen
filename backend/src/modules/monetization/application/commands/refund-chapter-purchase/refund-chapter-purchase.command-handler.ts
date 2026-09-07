import { createHash } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import {
  assertRefundChapterPurchaseInput,
  InvalidMonetizationInputException,
  requireMonetizationUserId,
} from '../../../domain';
import type { RefundChapterPurchaseResultDto } from '../../dto';
import { toRefundChapterPurchaseResult } from '../../mappers';
import {
  MONETIZATION_PERSISTENCE_PORT,
  type MonetizationPersistencePort,
} from '../../ports';
import { RefundChapterPurchaseCommand } from './refund-chapter-purchase.command';

@Injectable()
export class RefundChapterPurchaseCommandHandler {
  constructor(
    @Inject(MONETIZATION_PERSISTENCE_PORT)
    private readonly persistence: MonetizationPersistencePort,
  ) {}

  async execute(
    command: RefundChapterPurchaseCommand,
  ): Promise<RefundChapterPurchaseResultDto> {
    const actorId = requireMonetizationUserId(command.actorId);
    const reason = command.reason.trim();
    assertRefundChapterPurchaseInput({
      actorId,
      purchaseId: command.purchaseId,
      reason,
    });
    const idempotencyKey = command.idempotencyKey?.trim() ?? '';
    if (idempotencyKey.length < 8 || idempotencyKey.length > 200) {
      throw new InvalidMonetizationInputException(
        'Idempotency key phải có độ dài từ 8 đến 200 ký tự',
        'idempotencyKey',
      );
    }
    const requestHash = createHash('sha256')
      .update(JSON.stringify([command.purchaseId, reason, 'CHAPTER_REFUND']))
      .digest('hex');

    return toRefundChapterPurchaseResult(
      await this.persistence.refundChapterPurchase({
        actorId,
        purchaseId: command.purchaseId,
        reason,
        requestHash,
        ...(command.ipAddress ? { ipAddress: command.ipAddress } : {}),
        ...(command.userAgent ? { userAgent: command.userAgent } : {}),
        ...(command.requestId ? { requestId: command.requestId } : {}),
      }),
    );
  }
}
