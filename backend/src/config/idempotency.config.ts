import { registerAs } from '@nestjs/config';

import type { IdempotencyConfig } from './config.types';

export const IDEMPOTENCY_CONFIG_KEY = 'idempotency';

export default registerAs(IDEMPOTENCY_CONFIG_KEY, (): IdempotencyConfig => ({
  failureMode: (process.env.IDEMPOTENCY_FAILURE_MODE ??
    'closed') as IdempotencyConfig['failureMode'],
  maxResponseBytes: Number(
    process.env.IDEMPOTENCY_MAX_RESPONSE_BYTES ?? 1_048_576,
  ),
}));
