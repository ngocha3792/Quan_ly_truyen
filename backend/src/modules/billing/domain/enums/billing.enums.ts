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
export type PaymentOrderStatusName = (typeof PAYMENT_ORDER_STATUSES)[number];

export const PAYMENT_PROVIDER_KINDS = [
  'MANUAL_BANK_TRANSFER',
  'HMAC_SANDBOX',
  'VNPAY',
] as const;
export type PaymentProviderKindName = (typeof PAYMENT_PROVIDER_KINDS)[number];

export const PAYMENT_EVENT_TYPES = [
  'payment.succeeded',
  'payment.failed',
  'payment.refunded',
  'payment.reversed',
] as const;
export type PaymentEventType = (typeof PAYMENT_EVENT_TYPES)[number];
