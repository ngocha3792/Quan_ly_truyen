import Redis from 'ioredis';

const HEARTBEAT_KEY = 'worker:queue:heartbeat';

async function main(): Promise<void> {
  if (process.env.QUEUE_ENABLED !== 'true') {
    throw new Error('QUEUE_ENABLED must be true for the worker healthcheck');
  }

  if (process.env.QUEUE_WORKER_HEARTBEAT_ENABLED !== 'true') {
    throw new Error(
      'QUEUE_WORKER_HEARTBEAT_ENABLED must be true for the worker healthcheck',
    );
  }

  const redisUrl = process.env.REDIS_URL?.trim();

  if (!redisUrl) {
    throw new Error('REDIS_URL is required for the worker healthcheck');
  }

  const prefix = (process.env.REDIS_KEY_PREFIX ?? 'qlt').replace(/:+$/u, '');
  const ttlSeconds = parsePositiveInteger(
    process.env.QUEUE_WORKER_HEARTBEAT_TTL_SECONDS,
    30,
  );
  const connectTimeoutMs = parsePositiveInteger(
    process.env.REDIS_CONNECT_TIMEOUT_MS,
    5000,
  );
  const commandTimeoutMs = parsePositiveInteger(
    process.env.REDIS_COMMAND_TIMEOUT_MS,
    3000,
  );

  const redis = new Redis(redisUrl, {
    lazyConnect: true,
    enableReadyCheck: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: connectTimeoutMs,
    commandTimeout: commandTimeoutMs,
    keyPrefix: `${prefix}:`,
  });

  try {
    await redis.connect();

    const rawTimestamp = await redis.get(HEARTBEAT_KEY);

    if (!rawTimestamp) {
      throw new Error('Queue worker heartbeat is missing');
    }

    const timestamp = Number(rawTimestamp);

    if (!Number.isFinite(timestamp) || timestamp <= 0) {
      throw new Error('Queue worker heartbeat is malformed');
    }

    const ageMs = Math.max(0, Date.now() - timestamp);
    const maxAgeMs = ttlSeconds * 1000;

    if (ageMs > maxAgeMs) {
      throw new Error(
        `Queue worker heartbeat is stale: age=${ageMs}ms max=${maxAgeMs}ms`,
      );
    }
  } finally {
    redis.disconnect(false);
  }
}

function parsePositiveInteger(
  rawValue: string | undefined,
  fallback: number,
): number {
  const value = Number(rawValue ?? fallback);

  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`Invalid positive integer: ${String(rawValue)}`);
  }

  return value;
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';

  console.error(`[worker-healthcheck] ${message}`);
  process.exitCode = 1;
});
