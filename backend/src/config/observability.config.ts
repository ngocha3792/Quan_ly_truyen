import { hostname } from 'node:os';

import { registerAs } from '@nestjs/config';

import type { ObservabilityConfig } from './config.types';

export const OBSERVABILITY_CONFIG_KEY = 'observability';

export default registerAs(
  OBSERVABILITY_CONFIG_KEY,
  (): ObservabilityConfig => ({
    enabled: process.env.OBSERVABILITY_ENABLED !== 'false',
    serviceName: process.env.OTEL_SERVICE_NAME ?? 'quan-ly-truyen-api',
    serviceVersion: process.env.OTEL_SERVICE_VERSION ?? '0.0.1',
    serviceInstanceId:
      process.env.SERVICE_INSTANCE_ID ?? `${hostname()}-${process.pid}`,
    log: {
      level: (process.env.LOG_LEVEL ??
        'info') as ObservabilityConfig['log']['level'],
      pretty:
        process.env.NODE_ENV !== 'production' &&
        process.env.LOG_PRETTY === 'true',
      includeSource: process.env.LOG_INCLUDE_SOURCE === 'true',
    },
    metrics: {
      enabled: process.env.METRICS_ENABLED !== 'false',
      path: '/internal/metrics',
      bearerToken: process.env.METRICS_BEARER_TOKEN?.trim() || undefined,
      collectDefaultMetrics: process.env.METRICS_DEFAULT_ENABLED !== 'false',
      snapshotIntervalMs: Number(
        process.env.METRICS_SNAPSHOT_INTERVAL_MS ?? 10_000,
      ),
    },
  }),
);
