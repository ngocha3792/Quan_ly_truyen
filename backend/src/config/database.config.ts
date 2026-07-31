import { registerAs } from '@nestjs/config';

import type { DatabaseConfig } from './config.types';

export const DATABASE_CONFIG_KEY = 'database';

export default registerAs(DATABASE_CONFIG_KEY, (): DatabaseConfig => ({
  url: process.env.DATABASE_URL!,
}));
