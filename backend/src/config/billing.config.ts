import { registerAs } from '@nestjs/config';

import type { BillingConfig } from './config.types';

export const BILLING_CONFIG_KEY = 'billing';

export default registerAs(BILLING_CONFIG_KEY, (): BillingConfig => ({
  ...(process.env.PAYMENT_PROVIDER_CREDENTIAL_KEY
    ? { credentialKeyBase64: process.env.PAYMENT_PROVIDER_CREDENTIAL_KEY }
    : {}),
  providerMode:
    (process.env.PAYMENT_PROVIDER_MODE as
      BillingConfig['providerMode'] | undefined) ?? 'disabled',
  ...(process.env.PAYMENT_CHECKOUT_BASE_URL
    ? { checkoutBaseUrl: process.env.PAYMENT_CHECKOUT_BASE_URL }
    : {}),
  ...(process.env.PAYMENT_RETURN_URL
    ? { returnUrl: process.env.PAYMENT_RETURN_URL }
    : {}),
  ...(process.env.PAYMENT_WEBHOOK_SECRET
    ? { webhookSecret: process.env.PAYMENT_WEBHOOK_SECRET }
    : {}),
  webhookSignatureTtlSeconds: Number(
    process.env.PAYMENT_WEBHOOK_SIGNATURE_TTL_SECONDS ?? 300,
  ),
  webhookPollIntervalMs: Number(
    process.env.PAYMENT_WEBHOOK_POLL_INTERVAL_MS ?? 1_000,
  ),
  webhookBatchSize: Number(process.env.PAYMENT_WEBHOOK_BATCH_SIZE ?? 100),
  webhookMaxAttempts: Number(process.env.PAYMENT_WEBHOOK_MAX_ATTEMPTS ?? 5),
  webhookRetryBaseMs: Number(
    process.env.PAYMENT_WEBHOOK_RETRY_BASE_MS ?? 5_000,
  ),
  orderTtlMinutes: Number(process.env.PAYMENT_ORDER_TTL_MINUTES ?? 30),
  pendingOrderLimit: Number(process.env.PAYMENT_PENDING_ORDER_LIMIT ?? 3),
}));
