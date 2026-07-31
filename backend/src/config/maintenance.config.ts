import { registerAs } from '@nestjs/config';

import type { MaintenanceConfig } from './config.types';

export const MAINTENANCE_CONFIG_KEY = 'maintenance';

export default registerAs(MAINTENANCE_CONFIG_KEY, (): MaintenanceConfig => ({
  enabled: process.env.MAINTENANCE_MODE === 'true',
  message: process.env.MAINTENANCE_MESSAGE ?? 'Hệ thống đang bảo trì',
  retryAfterSeconds: Number(process.env.MAINTENANCE_RETRY_AFTER_SECONDS ?? 300),
  bypassHeaderName:
    process.env.MAINTENANCE_BYPASS_HEADER ?? 'x-maintenance-key',
  bypassToken: process.env.MAINTENANCE_BYPASS_TOKEN?.trim() || undefined,
  allowedPaths: [
    '/api/v1/health',
    '/api/v1/health/live',
    '/api/v1/health/ready',
  ],
}));
