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
}

export interface PaymentProviderAdapter {
  readonly kind: PaymentProviderKindName;
  readonly supportsWebhook: boolean;
  readonly requiresManualReview: boolean;
  validateConfig(config: unknown): Readonly<Record<string, unknown>>;
  createCheckout(input: PaymentCheckoutInput): Promise<PaymentCheckoutResult>;
  verifyWebhook(input: PaymentWebhookInput): Promise<NormalizedPaymentEvent>;
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
    readonly source: 'webhook' | 'admin_manual';
    readonly actorId?: string;
    readonly reason?: string;
    readonly ipAddress?: string;
    readonly userAgent?: string;
    readonly requestId?: string;
  }): Promise<void>;
}
