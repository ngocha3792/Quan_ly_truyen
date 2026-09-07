import type { PaymentEventType } from '../../domain';

export const PAYMENT_PROVIDER_PORT = Symbol('PAYMENT_PROVIDER_PORT');

export interface PaymentCheckoutInput {
  readonly orderId: string;
  readonly amountMinor: bigint;
  readonly currency: string;
  readonly expiresAt: Date;
}

export interface PaymentCheckoutResult {
  readonly providerReference: string;
  readonly checkoutUrl: string;
}

export interface PaymentWebhookInput {
  readonly providerCode: string;
  readonly rawBody: Buffer;
  readonly timestamp: string;
  readonly signature: string;
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

export interface PaymentProviderPort {
  readonly code: string;
  createCheckout(input: PaymentCheckoutInput): Promise<PaymentCheckoutResult>;
  verifyWebhook(input: PaymentWebhookInput): NormalizedPaymentEvent;
}
