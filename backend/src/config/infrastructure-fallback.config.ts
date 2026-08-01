import { registerAs } from '@nestjs/config';

import type { InfrastructureFallbackConfig } from './config.types';

export const INFRASTRUCTURE_FALLBACK_CONFIG_KEY = 'infrastructureFallback';

export default registerAs(
  INFRASTRUCTURE_FALLBACK_CONFIG_KEY,
  (): InfrastructureFallbackConfig => ({
    allowInMemory:
      process.env.ALLOW_IN_MEMORY_INFRASTRUCTURE_FALLBACK === 'true',
    inMemoryStoreMaxEntries: Number(
      process.env.IN_MEMORY_STORE_MAX_ENTRIES ?? 10_000,
    ),
    inMemoryStoreSweepIntervalMs: Number(
      process.env.IN_MEMORY_STORE_SWEEP_INTERVAL_MS ?? 60_000,
    ),
  }),
);
