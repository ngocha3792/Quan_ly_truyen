import { registerAs } from '@nestjs/config';
import type { AnalyticsConfig } from './config.types';

export const ANALYTICS_CONFIG_KEY = 'analytics';

export default registerAs(ANALYTICS_CONFIG_KEY, (): AnalyticsConfig => ({
  enabled: process.env.ANALYTICS_ENABLED === 'true',
  timeZone: process.env.ANALYTICS_TIME_ZONE ?? 'Asia/Ho_Chi_Minh',
  identityHmacSecret:
    process.env.ANALYTICS_IDENTITY_HMAC_SECRET ??
    'development-analytics-identity-secret-change-me',
  rawEventRetentionDays: Number(
    process.env.ANALYTICS_RAW_EVENT_RETENTION_DAYS ?? 30,
  ),
  maxBatchSize: Number(process.env.ANALYTICS_MAX_BATCH_SIZE ?? 50),
  completionThresholdPercent: Number(
    process.env.ANALYTICS_COMPLETION_THRESHOLD_PERCENT ?? 90,
  ),
  progressHeartbeatSeconds: Number(
    process.env.ANALYTICS_PROGRESS_HEARTBEAT_SECONDS ?? 15,
  ),
  rateLimitPerMinute: Number(
    process.env.ANALYTICS_RATE_LIMIT_PER_MINUTE ?? 120,
  ),
  rateLimitPerHour: Number(process.env.ANALYTICS_RATE_LIMIT_PER_HOUR ?? 600),
  dispatcherBatchSize: Number(
    process.env.ANALYTICS_DISPATCHER_BATCH_SIZE ?? 200,
  ),
  processingBatchSize: Number(
    process.env.ANALYTICS_PROCESSING_BATCH_SIZE ?? 200,
  ),
}));
