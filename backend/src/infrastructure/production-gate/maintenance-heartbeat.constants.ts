export const MAINTENANCE_HEARTBEAT_VERSION = 1 as const;

export const MAINTENANCE_HEARTBEAT_KEYS = {
  AUTH_CLEANUP: 'maintenance:auth-cleanup:last-success',

  OUTBOX_CLEANUP: 'maintenance:outbox-cleanup:last-success',

  MAIL_QUEUE_CLEANUP: 'maintenance:mail-queue-cleanup:last-success',
} as const;

export type MaintenanceHeartbeatKey =
  (typeof MAINTENANCE_HEARTBEAT_KEYS)[keyof typeof MAINTENANCE_HEARTBEAT_KEYS];

export interface MaintenanceHeartbeatV1 {
  version: typeof MAINTENANCE_HEARTBEAT_VERSION;

  command: string;

  completedAt: string;
}
