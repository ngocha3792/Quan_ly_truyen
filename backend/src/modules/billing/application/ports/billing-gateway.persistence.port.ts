import type {
  PaymentGatewayOrderInput,
  PaymentQueryResult,
  PaymentRefundResult,
} from './payment-provider.port';

export const BILLING_GATEWAY_PERSISTENCE_PORT = Symbol(
  'BILLING_GATEWAY_PERSISTENCE_PORT',
);

export interface BillingRefundRecord {
  readonly id: string;
  readonly orderId: string;
  readonly actorId: string;
  readonly idempotencyKey: string;
  readonly status: string;
  readonly amountMinor: string;
  readonly creditAmount: string;
  readonly currency: string;
  readonly reason: string;
  readonly providerRefundId: string | null;
  readonly responseCode: string | null;
  readonly createdAt: string;
  readonly completedAt: string | null;
}

export interface BillingGatewayOrder extends PaymentGatewayOrderInput {
  readonly status: string;
}

/**
 * Thông tin tối thiểu để quyết định có cho hoàn tiền tay hay không. Cố ý
 * không đi qua `getOrder` vì hàm đó chặn cứng mọi đơn không phải VNPay và
 * còn giải mã credential — thứ hoàn tiền tay không cần tới.
 */
export interface BillingRefundContext {
  readonly orderId: string;
  readonly status: string;
  readonly providerKind: string | null;
}

export interface ReserveBillingRefundInput {
  readonly actorId: string;
  readonly orderId: string;
  readonly reason: string;
  readonly idempotencyKey: string;
}

export interface BillingGatewayPersistencePort {
  getOrder(orderId: string): Promise<BillingGatewayOrder>;
  getRefundContext(orderId: string): Promise<BillingRefundContext>;
  listRefunds(orderId: string): Promise<readonly BillingRefundRecord[]>;
  reserveRefund(
    input: ReserveBillingRefundInput,
  ): Promise<{ refund: BillingRefundRecord; replayed: boolean }>;
  finishRefund(
    refundId: string,
    result: PaymentRefundResult,
  ): Promise<BillingRefundRecord>;
  applyVerifiedRefund(orderId: string, providerRefundId: string): Promise<void>;
  recordReconciliation(
    actorId: string,
    orderId: string,
    result: PaymentQueryResult,
  ): Promise<void>;
}
