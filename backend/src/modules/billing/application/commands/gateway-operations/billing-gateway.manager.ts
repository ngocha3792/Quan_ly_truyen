import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { AuthenticationRequiredException } from '@/common/exceptions';
import { isUuidV4 } from '@/common/utils';

import {
  InvalidBillingInputException,
  PaymentProviderUnavailableException,
} from '../../../domain';
import {
  BILLING_GATEWAY_PERSISTENCE_PORT,
  type BillingGatewayPersistencePort,
  type ReserveBillingRefundInput,
} from '../../ports/billing-gateway.persistence.port';
import {
  PAYMENT_PROVIDER_REGISTRY_PORT,
  type PaymentProviderRegistryPort,
  PAYMENT_SETTLEMENT_PORT,
  type PaymentSettlementPort,
  type PaymentRefundResult,
} from '../../ports/payment-provider.port';

@Injectable()
export class BillingGatewayManager {
  constructor(
    @Inject(BILLING_GATEWAY_PERSISTENCE_PORT)
    private readonly persistence: BillingGatewayPersistencePort,
    @Inject(PAYMENT_PROVIDER_REGISTRY_PORT)
    private readonly providers: PaymentProviderRegistryPort,
    @Inject(PAYMENT_SETTLEMENT_PORT)
    private readonly settlement: PaymentSettlementPort,
  ) {}

  async listRefunds(actorId: string | undefined, orderId: string) {
    validateActorOrder(actorId, orderId);
    return this.persistence.listRefunds(orderId);
  }

  async refund(
    input: Omit<ReserveBillingRefundInput, 'actorId' | 'idempotencyKey'> & {
      actorId: string | undefined;
      idempotencyKey: string | undefined;
    },
  ) {
    const actorId = validateActorOrder(input.actorId, input.orderId);
    const reason = input.reason.trim();
    const key = input.idempotencyKey?.trim() ?? '';
    if (
      reason.length < 5 ||
      reason.length > 500 ||
      !/^[a-zA-Z0-9_.:-]{8,160}$/u.test(key)
    ) {
      throw new InvalidBillingInputException(
        'Cần lý do hoàn tiền và khóa idempotency hợp lệ',
      );
    }
    const order = await this.persistence.getOrder(input.orderId);
    const provider = this.providers.getAdapter(order.connection.kind);
    if (!provider.refundPayment)
      throw new PaymentProviderUnavailableException(
        'Provider không hỗ trợ hoàn tiền tự động',
      );
    provider.assertReady?.(order.connection);
    const reserved = await this.persistence.reserveRefund({
      actorId,
      orderId: input.orderId,
      reason,
      idempotencyKey: `billing-refund:${key}`,
    });
    if (reserved.replayed) return reserved.refund;
    let result: PaymentRefundResult;
    try {
      result = await provider.refundPayment({
        ...order,
        requestId: reserved.refund.id,
        initiatedBy: actorId,
        reason,
      });
    } catch {
      result = {
        status: 'UNKNOWN',
        responseCode: 'PROVIDER_OPERATION_INTERRUPTED',
      };
    }
    return this.persistence.finishRefund(reserved.refund.id, result);
  }

  async reconcile(actorIdValue: string | undefined, orderId: string) {
    const actorId = validateActorOrder(actorIdValue, orderId);
    const order = await this.persistence.getOrder(orderId);
    const provider = this.providers.getAdapter(order.connection.kind);
    if (!provider.queryPayment)
      throw new PaymentProviderUnavailableException(
        'Provider không hỗ trợ truy vấn giao dịch',
      );
    const result = await provider.queryPayment({
      ...order,
      requestId: randomUUID(),
    });
    if (['SUCCEEDED', 'REFUNDED', 'FAILED'].includes(result.status)) {
      const event = result.event;
      const type =
        result.status === 'SUCCEEDED'
          ? 'payment.succeeded'
          : result.status === 'REFUNDED'
            ? 'payment.refunded'
            : 'payment.failed';
      if (
        !event ||
        event.orderId !== orderId ||
        event.providerReference !== order.providerReference ||
        event.amountMinor !== order.amountMinor.toString() ||
        event.currency !== order.currency ||
        event.type !== type ||
        !Number.isFinite(Date.parse(event.occurredAt))
      ) {
        throw new PaymentProviderUnavailableException(
          'Kết quả đối soát không khớp giao dịch gốc',
        );
      }
    }
    if (result.status === 'SUCCEEDED' && result.event) {
      await this.settlement.settleSucceeded({
        orderId,
        providerReference: order.providerReference,
        occurredAt: new Date(result.event.occurredAt),
        source: 'reconciliation',
        actorId,
        providerTransactionId: result.event.providerTransactionId,
        providerTransactionDate: result.event.providerTransactionDate,
      });
    } else if (result.status === 'REFUNDED' && result.providerTransactionId) {
      await this.persistence.applyVerifiedRefund(
        orderId,
        result.providerTransactionId,
      );
    }
    await this.persistence.recordReconciliation(actorId, orderId, result);
    const updated = await this.persistence.getOrder(orderId);
    const hasUnresolvedRefund = (
      await this.persistence.listRefunds(orderId)
    ).some((refund) => ['PENDING', 'UNKNOWN'].includes(refund.status));
    const matched = hasUnresolvedRefund
      ? false
      : result.status === 'SUCCEEDED'
        ? ['PAID', 'REFUNDED', 'REVERSED'].includes(updated.status)
        : result.status === 'REFUNDED'
          ? updated.status === 'REFUNDED'
          : result.status === 'FAILED'
            ? ['FAILED', 'EXPIRED'].includes(updated.status)
            : result.status === 'PENDING'
              ? ['CREATED', 'PENDING'].includes(updated.status)
              : false;
    return {
      status: updated.status,
      providerStatus: result.status,
      matched,
      message: hasUnresolvedRefund
        ? 'Yêu cầu hoàn tiền chưa có kết quả cuối cùng; Credit tiếp tục được giữ để đối soát.'
        : result.status === 'UNKNOWN'
          ? 'Chưa có xác nhận chắc chắn từ nhà cung cấp; cần kiểm tra lại.'
          : matched
            ? 'Trạng thái đơn đã khớp với nhà cung cấp.'
            : 'Có chênh lệch trạng thái cần kiểm tra.',
    };
  }
}

function validateActorOrder(
  actorId: string | undefined,
  orderId: string,
): string {
  if (!actorId || !isUuidV4(actorId))
    throw new AuthenticationRequiredException();
  if (!isUuidV4(orderId))
    throw new InvalidBillingInputException('Đơn thanh toán không hợp lệ');
  return actorId;
}
