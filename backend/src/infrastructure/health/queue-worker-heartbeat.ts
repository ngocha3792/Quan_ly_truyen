import type Redis from 'ioredis';

import type { QueueConfig } from '@/config';

export const QUEUE_WORKER_HEARTBEAT_KEY = 'worker:queue:heartbeat';

export type QueueWorkerHeartbeatStatus = 'up' | 'down' | 'disabled';

export interface QueueWorkerHeartbeatSnapshot {
  status: QueueWorkerHeartbeatStatus;
  lastHeartbeatAt?: string;
  ageMs?: number;
}

export async function readQueueWorkerHeartbeat(
  redisClient: Redis | null,
  queueConfig: QueueConfig,
): Promise<QueueWorkerHeartbeatSnapshot> {
  if (!queueConfig.enabled || !queueConfig.workerHeartbeatEnabled) {
    return { status: 'disabled' };
  }

  if (!redisClient) {
    return { status: 'down' };
  }

  try {
    const rawTimestamp = await redisClient.get(QUEUE_WORKER_HEARTBEAT_KEY);

    if (!rawTimestamp) {
      return { status: 'down' };
    }

    const timestamp = Number(rawTimestamp);

    if (!Number.isFinite(timestamp) || timestamp <= 0) {
      return { status: 'down' };
    }

    const ageMs = Math.max(0, Date.now() - timestamp);
    const maxAgeMs = queueConfig.workerHeartbeatTtlSeconds * 1000;

    return {
      status: ageMs <= maxAgeMs ? 'up' : 'down',
      lastHeartbeatAt: new Date(timestamp).toISOString(),
      ageMs,
    };
  } catch {
    return { status: 'down' };
  }
}
