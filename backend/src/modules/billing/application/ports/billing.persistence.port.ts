import type {
  PaymentOrderStatusName,
  PaymentProviderKindName,
} from '../../domain';
import type { NormalizedPaymentEvent } from './payment-provider.port';

export const BILLING_PERSISTENCE_PORT = Symbol('BILLING_PERSISTENCE_PORT');

export interface CreditPackageRecord {
  readonly id: string;
  readonly code: string;
  readonly label: string;
  readonly creditAmount: bigint;
  readonly fiatAmountMinor: bigint;
  readonly currency: string;
  readonly isActive: boolean;
  readonly sortOrder: number;
  readonly updatedAt: Date;
}

export interface PaymentOrderRecord {
  readonly id: string;
  readonly userId: string;
  readonly packageId: string;
  readonly provider: string;
  readonly providerConnectionId: string | null;
  readonly providerReference: string | null;
  readonly creditAmount: bigint;
  readonly fiatAmountMinor: bigint;
  readonly currency: string;
  readonly status: PaymentOrderStatusName;
  readonly checkoutUrl: string | null;
  readonly walletTransactionId: string | null;
  readonly failureCode: string | null;
  readonly metadata: unknown;
  readonly reviewRequestedAt: Date | null;
  readonly reviewedAt: Date | null;
  readonly reviewedById: string | null;
  readonly reviewReason: string | null;
  readonly expiresAt: Date;
  readonly settledAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface PaymentProviderConnectionRecord {
  readonly id: string;
  readonly code: string;
  readonly kind: PaymentProviderKindName;
  readonly displayName: string;
  readonly description: string | null;
  readonly config: Readonly<Record<string, unknown>>;
  readonly currency: string;
  readonly enabled: boolean;
  readonly sortOrder: number;
  readonly orderTtlMinutes: number | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface PaymentOrderPageRecord {
  readonly items: readonly PaymentOrderRecord[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

export interface AdminPaymentOrderRecord extends PaymentOrderRecord {
  readonly userEmail: string;
  readonly userDisplayName: string;
  readonly packageLabel: string;
}

export interface AdminPaymentOrderPageRecord {
  readonly items: readonly AdminPaymentOrderRecord[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

export interface PreparePaymentOrderInput {
  readonly userId: string;
  readonly packageId: string;
  readonly provider: string;
  readonly providerConnectionId: string;
  readonly idempotencyKey: string;
  readonly requestHash: string;
  readonly ttlMinutes: number;
  readonly pendingOrderLimit: number;
}

export interface PreparedPaymentOrder {
  readonly order: PaymentOrderRecord;
  readonly replayed: boolean;
}

export interface PaymentReconciliationRecord {
  readonly paidOrders: number;
  readonly paidOrdersWithoutLedger: number;
  readonly orphanTopUpTransactions: number;
  readonly pendingExpiredOrders: number;
  readonly awaitingReviewOrders: number;
  readonly awaitingReviewOlderThan24h: number;
}

export interface BillingPersistencePort {
  resolveConnection(id?: string): Promise<PaymentProviderConnectionRecord>;
  getConnectionByCode(code: string): Promise<PaymentProviderConnectionRecord>;
  listConnections(
    enabledOnly: boolean,
  ): Promise<readonly PaymentProviderConnectionRecord[]>;
  createConnection(input: {
    actorId: string;
    code: string;
    kind: PaymentProviderKindName;
    displayName: string;
    description?: string;
    config: Readonly<Record<string, unknown>>;
    currency: string;
    enabled: boolean;
    sortOrder: number;
    orderTtlMinutes?: number;
  }): Promise<PaymentProviderConnectionRecord>;
  updateConnection(input: {
    actorId: string;
    id: string;
    displayName?: string;
    description?: string | null;
    config?: Readonly<Record<string, unknown>>;
    currency?: string;
    enabled?: boolean;
    sortOrder?: number;
    orderTtlMinutes?: number | null;
  }): Promise<PaymentProviderConnectionRecord>;
  deleteConnection(actorId: string, id: string): Promise<void>;
  receiveWebhookEvent(input: {
    provider: string;
    event: NormalizedPaymentEvent;
    payloadHash: string;
  }): Promise<{ readonly duplicate: boolean }>;
  listPackages(activeOnly: boolean): Promise<readonly CreditPackageRecord[]>;
  updatePackage(input: {
    actorId: string;
    packageId: string;
    label?: string;
    creditAmount?: bigint;
    fiatAmountMinor?: bigint;
    currency?: string;
    isActive?: boolean;
    sortOrder?: number;
  }): Promise<CreditPackageRecord>;
  prepareOrder(input: PreparePaymentOrderInput): Promise<PreparedPaymentOrder>;
  attachCheckout(input: {
    orderId: string;
    providerReference: string;
    checkoutUrl: string;
  }): Promise<PaymentOrderRecord>;
  attachInstructions(input: {
    orderId: string;
    providerReference: string;
    instructions: Readonly<Record<string, unknown>>;
  }): Promise<PaymentOrderRecord>;
  markOrderTransferred(input: {
    userId: string;
    orderId: string;
    referenceCode?: string;
    note?: string;
  }): Promise<PaymentOrderRecord>;
  rejectManualOrder(input: {
    actorId: string;
    orderId: string;
    reason: string;
    ipAddress?: string;
    userAgent?: string;
    requestId?: string;
  }): Promise<PaymentOrderRecord>;
  getOrderForReview(orderId: string): Promise<PaymentOrderRecord>;
  markCheckoutFailed(orderId: string, failureCode: string): Promise<void>;
  getOwnOrder(userId: string, orderId: string): Promise<PaymentOrderRecord>;
  listOwnOrders(input: {
    userId: string;
    page: number;
    pageSize: number;
  }): Promise<PaymentOrderPageRecord>;
  listAdminOrders(input: {
    page: number;
    pageSize: number;
    status?: PaymentOrderStatusName;
    provider?: string;
    query?: string;
    from?: Date;
    to?: Date;
  }): Promise<AdminPaymentOrderPageRecord>;
  reconcile(): Promise<PaymentReconciliationRecord>;
}
