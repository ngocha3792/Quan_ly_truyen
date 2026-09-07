export const PAYMENT_ORDER_STATUSES = [
  'CREATED',
  'PENDING',
  'PAID',
  'FAILED',
  'EXPIRED',
  'REFUNDED',
  'REVERSED',
] as const;
export type PaymentOrderStatusName = (typeof PAYMENT_ORDER_STATUSES)[number];

export const PAYMENT_EVENT_TYPES = [
  'payment.succeeded',
  'payment.failed',
  'payment.refunded',
  'payment.reversed',
] as const;
export type PaymentEventType = (typeof PAYMENT_EVENT_TYPES)[number];
