import { registerAs } from '@nestjs/config';
import { API_PATHS } from '@/common/constants';

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
    API_PATHS.HEALTH,
    API_PATHS.HEALTH_LIVE,
    API_PATHS.HEALTH_READY,
  ],
}));
