import { Inject, Injectable } from '@nestjs/common';

import { AuthenticationRequiredException } from '@/common/exceptions';
import { isUuidV4 } from '@/common/utils';

import {
  InvalidBillingInputException,
  PaymentOrderTransitionException,
} from '../../../domain';
import { toPaymentOrderResult } from '../../mappers';
import {
  BILLING_PERSISTENCE_PORT,
  type BillingPersistencePort,
  PAYMENT_SETTLEMENT_PORT,
  type PaymentSettlementPort,
} from '../../ports';

export class MarkPaymentOrderTransferredCommand {
  constructor(
    readonly userId: string | undefined,
    readonly orderId: string,
    readonly referenceCode?: string,
    readonly note?: string,
  ) {}
}

export class ConfirmManualPaymentOrderCommand {
  constructor(
    readonly actorId: string | undefined,
    readonly orderId: string,
    readonly reason: string,
    readonly idempotencyKey: string | undefined,
    readonly ipAddress?: string,
    readonly userAgent?: string,
    readonly requestId?: string,
  ) {}
}

export class RejectManualPaymentOrderCommand extends ConfirmManualPaymentOrderCommand {}

@Injectable()
export class MarkPaymentOrderTransferredCommandHandler {
  constructor(
    @Inject(BILLING_PERSISTENCE_PORT)
    private readonly persistence: BillingPersistencePort,
  ) {}

  async execute(command: MarkPaymentOrderTransferredCommand) {
    const userId = requiredActor(command.userId);
    if (!isUuidV4(command.orderId))
      throw new InvalidBillingInputException('Đơn thanh toán không hợp lệ');
    const referenceCode = optionalText(
      command.referenceCode,
      120,
      'referenceCode',
    );
    const note = optionalText(command.note, 500, 'note');
    const order = await this.persistence.getOwnOrder(userId, command.orderId);
    const connection = await this.persistence.getConnectionByCode(
      order.provider,
    );
    if (connection?.kind !== 'MANUAL_BANK_TRANSFER') {
      throw new PaymentOrderTransitionException(
        order.status,
        'AWAITING_REVIEW',
      );
    }
    return toPaymentOrderResult(
      await this.persistence.markOrderTransferred({
        userId,
        orderId: command.orderId,
        referenceCode,
        note,
      }),
    );
  }
}

@Injectable()
export class ConfirmManualPaymentOrderCommandHandler {
  constructor(
    @Inject(BILLING_PERSISTENCE_PORT)
    private readonly persistence: BillingPersistencePort,
    @Inject(PAYMENT_SETTLEMENT_PORT)
    private readonly settlement: PaymentSettlementPort,
  ) {}

  async execute(command: ConfirmManualPaymentOrderCommand) {
    const actorId = requiredActor(command.actorId);
    validateAdminMutation(command.reason, command.idempotencyKey);
    const order = await this.persistence.getOrderForReview(command.orderId);
    if (order.status !== 'AWAITING_REVIEW' || !order.providerReference) {
      throw new PaymentOrderTransitionException(order.status, 'PAID');
    }
    await this.settlement.settleSucceeded({
      orderId: order.id,
      providerReference: order.providerReference,
      occurredAt: new Date(),
      source: 'admin_manual',
      actorId,
      reason: command.reason.trim(),
      ipAddress: command.ipAddress,
      userAgent: command.userAgent,
      requestId: command.requestId,
    });
    return toPaymentOrderResult(
      await this.persistence.getOrderForReview(order.id),
    );
  }
}

@Injectable()
export class RejectManualPaymentOrderCommandHandler {
  constructor(
    @Inject(BILLING_PERSISTENCE_PORT)
    private readonly persistence: BillingPersistencePort,
  ) {}

  async execute(command: RejectManualPaymentOrderCommand) {
    const actorId = requiredActor(command.actorId);
    validateAdminMutation(command.reason, command.idempotencyKey);
    return toPaymentOrderResult(
      await this.persistence.rejectManualOrder({
        actorId,
        orderId: command.orderId,
        reason: command.reason.trim(),
        ipAddress: command.ipAddress,
        userAgent: command.userAgent,
        requestId: command.requestId,
      }),
    );
  }
}

function requiredActor(value: string | undefined): string {
  if (!value || !isUuidV4(value)) throw new AuthenticationRequiredException();
  return value;
}

function optionalText(
  value: string | undefined,
  max: number,
  field: string,
): string | undefined {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  if (normalized.length > max)
    throw new InvalidBillingInputException(`${field} quá dài`, field);
  return normalized;
}

function validateAdminMutation(
  reason: string,
  idempotencyKey: string | undefined,
): void {
  const reasonLength = reason.trim().length;
  if (reasonLength < 10 || reasonLength > 500)
    throw new InvalidBillingInputException(
      'Lý do phải có độ dài từ 10 đến 500 ký tự',
      'reason',
    );
  const keyLength = idempotencyKey?.trim().length ?? 0;
  if (keyLength < 8 || keyLength > 200)
    throw new InvalidBillingInputException(
      'Idempotency key phải có độ dài từ 8 đến 200 ký tự',
      'idempotencyKey',
    );
}
