import type { PaymentOrderStatusName } from '../../domain';
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
  readonly providerReference: string | null;
  readonly creditAmount: bigint;
  readonly fiatAmountMinor: bigint;
  readonly currency: string;
  readonly status: PaymentOrderStatusName;
  readonly checkoutUrl: string | null;
  readonly walletTransactionId: string | null;
  readonly failureCode: string | null;
  readonly expiresAt: Date;
  readonly settledAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface PaymentOrderPageRecord {
  readonly items: readonly PaymentOrderRecord[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

export interface PreparePaymentOrderInput {
  readonly userId: string;
  readonly packageId: string;
  readonly provider: string;
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
}

export interface BillingPersistencePort {
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
  markCheckoutFailed(orderId: string, failureCode: string): Promise<void>;
  getOwnOrder(userId: string, orderId: string): Promise<PaymentOrderRecord>;
  listOwnOrders(input: {
    userId: string;
    page: number;
    pageSize: number;
  }): Promise<PaymentOrderPageRecord>;
  reconcile(): Promise<PaymentReconciliationRecord>;
}
