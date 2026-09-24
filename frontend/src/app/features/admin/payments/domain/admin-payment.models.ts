export type PaymentProviderKind = 'MANUAL_BANK_TRANSFER' | 'HMAC_SANDBOX' | 'VNPAY';

export interface PaymentProviderConnection {
  readonly id: string;
  readonly code: string;
  readonly kind: PaymentProviderKind;
  readonly displayName: string;
  readonly description: string | null;
  readonly config: Record<string, unknown>;
  readonly currency: string;
  readonly enabled: boolean;
  readonly sortOrder: number;
  readonly orderTtlMinutes: number | null;
  readonly configurationReady: boolean;
  readonly missingConfigurationFields: readonly string[];
  readonly secretConfiguredFields: readonly string[];
  readonly webhookUrl: string | null;
  readonly returnUrl: string | null;
  readonly credentialsStorageAvailable: boolean;
}

export type PaymentProviderWrite = Omit<
  PaymentProviderConnection,
  | 'id'
  | 'configurationReady'
  | 'missingConfigurationFields'
  | 'secretConfiguredFields'
  | 'webhookUrl'
  | 'returnUrl'
  | 'credentialsStorageAvailable'
> & { readonly credentials?: Readonly<Record<string, string>> };

export interface PaymentProviderField {
  readonly name: string;
  readonly label: string;
  readonly required: boolean;
  readonly placeholder?: string;
  readonly type?: 'text' | 'password' | 'url' | 'select';
  readonly secret?: boolean;
  readonly options?: readonly { readonly value: string; readonly label: string }[];
  readonly defaultValue?: string;
}

export interface PaymentProviderKindSchema {
  readonly kind: PaymentProviderKind;
  readonly supportsWebhook: boolean;
  readonly requiresManualReview: boolean;
  readonly fields: readonly PaymentProviderField[];
}

export const PAYMENT_ORDER_STATUSES = [
  'CREATED',
  'PENDING',
  'AWAITING_REVIEW',
  'PAID',
  'FAILED',
  'EXPIRED',
  'REFUNDED',
  'REVERSED',
] as const;

export type PaymentOrderStatus = (typeof PAYMENT_ORDER_STATUSES)[number];

export interface ManualReviewOrder {
  readonly id: string;
  readonly userEmail: string;
  readonly userDisplayName: string;
  readonly packageLabel: string;
  readonly provider: string;
  readonly providerKind?: PaymentProviderKind;
  readonly providerReference: string | null;
  readonly creditAmount: string;
  readonly fiatAmountMinor: string;
  readonly currency: string;
  readonly status: PaymentOrderStatus;
  readonly transferClaim: Record<string, unknown> | null;
  readonly createdAt: string;
  readonly settledAt: string | null;
}

/** Bộ lọc của hàng chờ đối soát, khớp đúng tham số API hỗ trợ. */
export interface ManualReviewFilters {
  readonly search: string;
  readonly status: PaymentOrderStatus | '';
  readonly provider: string;
  readonly from: string;
  readonly to: string;
  /** Lọc phía client: chỉ đơn chờ duyệt đã quá 24 giờ. */
  readonly overdueOnly: boolean;
}

export const EMPTY_MANUAL_REVIEW_FILTERS: ManualReviewFilters = {
  search: '',
  status: 'AWAITING_REVIEW',
  provider: '',
  from: '',
  to: '',
  overdueOnly: false,
};

/** Số liệu đối soát, tính bằng SQL nên không phụ thuộc trang đang tải. */
export interface PaymentReconciliation {
  readonly paidOrders: number;
  readonly paidOrdersWithoutLedger: number;
  readonly orphanTopUpTransactions: number;
  readonly pendingExpiredOrders: number;
  readonly awaitingReviewOrders: number;
  readonly awaitingReviewOlderThan24h: number;
  readonly awaitingReviewAmountMinor: string;
  readonly confirmedToday: number;
}

export interface PageResult<T> {
  readonly items: readonly T[];
  readonly pagination: {
    readonly page: number;
    readonly pageSize: number;
    readonly totalItems: number;
    readonly totalPages: number;
  };
}
