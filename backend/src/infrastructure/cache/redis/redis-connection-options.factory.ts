import type { RedisOptions } from 'ioredis';

export function createRedisConnectionOptions(
  redisUrl: string,
  overrides: RedisOptions = {},
): RedisOptions {
  let parsed: URL;
  try {
    parsed = new URL(redisUrl);
  } catch {
    throw new Error('REDIS_URL must be a valid redis:// or rediss:// URL');
  }

  if (!['redis:', 'rediss:'].includes(parsed.protocol)) {
    throw new Error('REDIS_URL protocol must be redis:// or rediss://');
  }

  const databasePath = parsed.pathname.replace(/^\//, '');
  const database = databasePath === '' ? 0 : Number(databasePath);
  if (!Number.isInteger(database) || database < 0) {
    throw new Error('REDIS_URL database must be a non-negative integer');
  }

  const options: RedisOptions = {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    db: database,
    ...(parsed.protocol === 'rediss:'
      ? { tls: { servername: parsed.hostname } }
      : {}),
    ...overrides,
  };

  return options;
}
