import { registerAs } from '@nestjs/config';

import type { RedisConfig } from './config.types';

export const REDIS_CONFIG_KEY = 'redis';

export default registerAs(REDIS_CONFIG_KEY, (): RedisConfig => ({
  enabled: process.env.REDIS_ENABLED === 'true',
  url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  keyPrefix: process.env.REDIS_KEY_PREFIX ?? 'qlt',
  connectTimeoutMs: Number(process.env.REDIS_CONNECT_TIMEOUT_MS ?? 5000),
  commandTimeoutMs: Number(process.env.REDIS_COMMAND_TIMEOUT_MS ?? 3000),
  cacheDefaultTtlSeconds: Number(process.env.CACHE_DEFAULT_TTL_SECONDS ?? 300),
}));
