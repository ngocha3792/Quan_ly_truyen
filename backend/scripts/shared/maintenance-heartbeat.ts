import { randomUUID } from 'node:crypto';

import Redis from 'ioredis';

import { createRedisConnectionOptions } from '@/infrastructure/cache/redis';

import {
  MAINTENANCE_HEARTBEAT_KEYS,
  MAINTENANCE_HEARTBEAT_VERSION,
  type MaintenanceHeartbeatKey,
  type MaintenanceHeartbeatV1,
} from '@/infrastructure/production-gate';

import { requireEnvironmentVariable } from './environment';

export type MaintenanceCommand =
  'auth-cleanup' | 'outbox-cleanup' | 'mail-queue-cleanup';

const HEARTBEAT_TTL_SECONDS = 7 * 24 * 60 * 60;

export async function recordMaintenanceSuccess(
  command: MaintenanceCommand,
): Promise<void> {
  if (process.env.REDIS_ENABLED !== 'true') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'REDIS_ENABLED must be true to record production maintenance heartbeat',
      );
    }

    return;
  }

  const redisUrl = requireEnvironmentVariable('REDIS_URL');

  const keyPrefix = process.env.REDIS_KEY_PREFIX?.trim() || 'qlt';

  const connectTimeoutMs = Number(process.env.REDIS_CONNECT_TIMEOUT_MS ?? 5000);

  const client = new Redis(
    createRedisConnectionOptions(
      redisUrl,

      {
        keyPrefix: `${keyPrefix}:`,

        connectTimeout: connectTimeoutMs,

        maxRetriesPerRequest: 3,
      },
    ),
  );

  try {
    const heartbeat: MaintenanceHeartbeatV1 = {
      version: MAINTENANCE_HEARTBEAT_VERSION,

      command: `${command}:${randomUUID()}`,

      completedAt: new Date().toISOString(),
    };

    const result = await client.set(
      resolveKey(command),

      JSON.stringify(heartbeat),

      'EX',

      HEARTBEAT_TTL_SECONDS,
    );

    if (result !== 'OK') {
      throw new Error('Redis did not acknowledge maintenance heartbeat');
    }
  } finally {
    await client.quit().catch(() => {
      client.disconnect();
    });
  }
}

function resolveKey(command: MaintenanceCommand): MaintenanceHeartbeatKey {
  switch (command) {
    case 'auth-cleanup':
      return MAINTENANCE_HEARTBEAT_KEYS.AUTH_CLEANUP;

    case 'outbox-cleanup':
      return MAINTENANCE_HEARTBEAT_KEYS.OUTBOX_CLEANUP;

    case 'mail-queue-cleanup':
      return MAINTENANCE_HEARTBEAT_KEYS.MAIL_QUEUE_CLEANUP;
  }
}
