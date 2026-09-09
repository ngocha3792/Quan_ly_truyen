import type { PaymentEventType, PaymentProviderKindName } from '../../domain';

export const PAYMENT_PROVIDER_REGISTRY_PORT = Symbol(
  'PAYMENT_PROVIDER_REGISTRY_PORT',
);
export const PAYMENT_SETTLEMENT_PORT = Symbol('PAYMENT_SETTLEMENT_PORT');

export interface PaymentProviderConnectionDescriptor {
  readonly id: string;
  readonly code: string;
  readonly kind: PaymentProviderKindName;
  readonly displayName: string;
  readonly config: Readonly<Record<string, unknown>>;
  /** Decrypted only for server-side provider operations; never return in DTOs. */
  readonly secrets?: Readonly<Record<string, string>>;
  readonly currency: string;
  readonly orderTtlMinutes: number | null;
}

export interface PaymentTransferInstructions extends Readonly<
  Record<string, unknown>
> {
  readonly bankName: string;
  readonly accountNumber: string;
  readonly accountHolder: string;
  readonly branch: string | null;
  readonly transferNote: string;
  readonly instructionNote: string | null;
}

export interface PaymentCheckoutInput {
  readonly orderId: string;
  readonly userId: string;
  readonly connection: PaymentProviderConnectionDescriptor;
  readonly amountMinor: bigint;
  readonly currency: string;
  readonly expiresAt: Date;
  readonly createdAt?: Date;
  readonly ipAddress?: string;
}

export type PaymentCheckoutResult =
  | {
      readonly kind: 'redirect';
      readonly providerReference: string;
      readonly checkoutUrl: string;
    }
  | {
      readonly kind: 'instructions';
      readonly providerReference: string;
      readonly instructions: PaymentTransferInstructions;
    };

export interface PaymentWebhookInput {
  readonly connection?: PaymentProviderConnectionDescriptor;
  readonly providerCode: string;
  readonly rawBody: Buffer;
  readonly headers: Readonly<Record<string, string | undefined>>;
}

export interface NormalizedPaymentEvent {
  readonly eventId: string;
  readonly type: PaymentEventType;
  readonly orderId: string;
  readonly providerReference: string;
  readonly amountMinor: string;
  readonly currency: string;
  readonly occurredAt: string;
  readonly providerTransactionId?: string;
  readonly providerTransactionDate?: string;
}

export interface PaymentGatewayOrderInput {
  readonly connection: PaymentProviderConnectionDescriptor;
  readonly orderId: string;
  readonly providerReference: string;
  readonly amountMinor: bigint;
  readonly currency: string;
  readonly createdAt: Date;
  readonly providerTransactionId?: string;
}

export interface PaymentQueryInput extends PaymentGatewayOrderInput {
  readonly requestId: string;
}

export interface PaymentRefundInput extends PaymentQueryInput {
  readonly initiatedBy: string;
  readonly reason: string;
}

export interface PaymentQueryResult {
  readonly status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED' | 'UNKNOWN';
  readonly responseCode: string;
  readonly providerTransactionId?: string;
  readonly event?: NormalizedPaymentEvent;
}

export interface PaymentRefundResult {
  readonly status: 'SUCCEEDED' | 'PENDING' | 'FAILED' | 'UNKNOWN';
  readonly responseCode: string;
  readonly providerRefundId?: string;
}

export interface PaymentProviderAdapter {
  readonly kind: PaymentProviderKindName;
  readonly supportsWebhook: boolean;
  readonly requiresManualReview: boolean;
  validateConfig(config: unknown): Readonly<Record<string, unknown>>;
  assertReady?(connection: PaymentProviderConnectionDescriptor): void;
  createCheckout(input: PaymentCheckoutInput): Promise<PaymentCheckoutResult>;
  verifyWebhook(input: PaymentWebhookInput): Promise<NormalizedPaymentEvent>;
  queryPayment?(input: PaymentQueryInput): Promise<PaymentQueryResult>;
  refundPayment?(input: PaymentRefundInput): Promise<PaymentRefundResult>;
}

export interface PaymentProviderRegistryPort {
  getAdapter(kind: PaymentProviderKindName): PaymentProviderAdapter;
  listKinds(): readonly PaymentProviderKindName[];
}

export interface PaymentSettlementPort {
  settleSucceeded(input: {
    readonly orderId: string;
    readonly providerReference: string;
    readonly occurredAt: Date;
    readonly source: 'webhook' | 'admin_manual' | 'reconciliation';
    readonly providerTransactionId?: string;
    readonly providerTransactionDate?: string;
    readonly actorId?: string;
    readonly reason?: string;
    readonly ipAddress?: string;
    readonly userAgent?: string;
    readonly requestId?: string;
  }): Promise<void>;
}
