export const MONETIZATION_RATE_LIMITER_PORT = Symbol.for(
  'modules.monetization.rate-limiter',
);

export type MonetizationRateLimitOperation =
  | 'chapter_unlock'
  | 'order_create'
  | 'order_transfer_claim'
  | 'order_poll'
  | 'payment_webhook';

export const MONETIZATION_RATE_LIMITS_PER_MINUTE: Readonly<
  Record<MonetizationRateLimitOperation, number>
> = {
  chapter_unlock: 30,
  order_create: 6,
  order_transfer_claim: 6,
  order_poll: 120,
  payment_webhook: 600,
};

export interface MonetizationRateLimiterPort {
  consume(input: {
    readonly operation: MonetizationRateLimitOperation;
    readonly subject: string;
  }): Promise<void>;
}
