import { registerAs } from '@nestjs/config';

import type { QueueConfig } from './config.types';

export const QUEUE_CONFIG_KEY = 'queue';

export default registerAs(QUEUE_CONFIG_KEY, (): QueueConfig => ({
  enabled: process.env.QUEUE_ENABLED === 'true',
  prefix: process.env.QUEUE_PREFIX ?? 'qlt',
  defaultAttempts: Number(process.env.QUEUE_DEFAULT_ATTEMPTS ?? 3),
  defaultBackoffMs: Number(process.env.QUEUE_DEFAULT_BACKOFF_MS ?? 5000),
  workerConcurrency: Number(process.env.WORKER_CONCURRENCY ?? 5),
}));
