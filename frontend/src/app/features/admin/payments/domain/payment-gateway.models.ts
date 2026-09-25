export interface GatewayRefundSummary {
  readonly id: string;
  readonly status: string;
  readonly reason: string;
  readonly providerRefundId: string | null;
  readonly createdAt: string;
  readonly completedAt: string | null;
}

export interface GatewayOrder {
  readonly id: string;
  readonly userEmail: string;
  readonly userDisplayName: string;
  readonly provider: string;
  readonly providerKind: string;
  readonly providerConfigurationReady: boolean;
  readonly providerReference: string | null;
  readonly creditAmount: string;
  readonly fiatAmountMinor: string;
  readonly currency: string;
  readonly status: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  /** Lần hoàn tiền gần nhất của đơn, nếu có. */
  readonly refund?: GatewayRefundSummary;
}

export interface GatewayRefund {
  readonly id: string;
  readonly status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'UNKNOWN';
  readonly amountMinor: string;
  readonly currency: string;
  readonly reason: string;
  readonly providerRefundId: string | null;
  readonly createdAt: string;
}

export interface GatewayReconciliation {
  readonly status: string;
  readonly providerStatus: string;
  readonly matched: boolean;
  readonly message: string;
}

/** Số liệu toàn hệ thống, tính bằng SQL nên không phụ thuộc trang đang xem. */
export interface BillingIntegritySummary {
  readonly paidOrders: number;
  readonly paidOrdersWithoutLedger: number;
  readonly orphanTopUpTransactions: number;
  readonly pendingExpiredOrders: number;
  readonly awaitingReviewOrders: number;
  readonly awaitingReviewOlderThan24h: number;
}

export interface GatewayFilters {
  readonly search: string;
  readonly status: string;
  readonly provider: string;
  readonly from: string;
  readonly to: string;
}

export const EMPTY_GATEWAY_FILTERS: GatewayFilters = {
  search: '',
  status: '',
  provider: '',
  from: '',
  to: '',
};

export type GatewayTab = 'all' | 'paid' | 'refunded' | 'attention';

export interface StoryPaymentAllowlist {
  readonly isEnabled: boolean;
  readonly enabledProviders: readonly string[];
}

/**
 * Chỉ VNPay có API truy vấn và hoàn tiền. Các cổng còn lại phải đối soát và
 * chuyển trả bằng tay, nên giao diện phải nói rõ thay vì để bấm rồi báo lỗi.
 */
export function supportsProviderOperations(order: GatewayOrder): boolean {
  return order.providerKind === 'VNPAY';
}

export function refundState(order: GatewayOrder): string {
  return order.refund?.status ?? 'NONE';
}

export function needsAttention(order: GatewayOrder): boolean {
  return ['PENDING', 'UNKNOWN'].includes(refundState(order));
}
