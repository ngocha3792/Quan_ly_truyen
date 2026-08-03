import { registerAs } from '@nestjs/config';

import type { ProductionGateConfig } from './config.types';

export const PRODUCTION_GATE_CONFIG_KEY = 'productionGate';

export default registerAs(
  PRODUCTION_GATE_CONFIG_KEY,

  (): ProductionGateConfig => ({
    migrationsPath:
      process.env.PRODUCTION_GATE_MIGRATIONS_PATH ?? 'prisma/migrations',

    cleanupMaxAgeHours: Number(
      process.env.PRODUCTION_GATE_CLEANUP_MAX_AGE_HOURS ?? 30,
    ),
  }),
);
