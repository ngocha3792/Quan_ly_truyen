import { setTimeout as sleep } from 'node:timers/promises';

import Redis from 'ioredis';
import { Client } from 'pg';

import {
  assertNotProduction,
  requireEnvironmentVariable,
} from '../shared/environment';
import { runCommand } from '../shared/process-command';
import { ScriptError, ScriptExitCode } from '../shared/script-error';
import { runScript } from '../shared/script-runner';

let adminClient: Client | undefined;
let redis: Redis | undefined;

void runScript({
  name: 'prepare-auth-test-environment',

  async execute({ logger }) {
    assertNotProduction('Preparing the Auth test environment');

    const testDatabaseUrl = requireEnvironmentVariable('TEST_DATABASE_URL');
    const testRedisUrl = requireEnvironmentVariable('TEST_REDIS_URL');
    const allowUnsafe = process.env.ALLOW_UNSAFE_TEST_DB === 'true';

    const database = parseDatabaseUrl(testDatabaseUrl);
    const redisDatabase = parseRedisDatabase(testRedisUrl);

    if (!allowUnsafe && !/(^|[_-])test($|[_-])/u.test(database.name)) {
      throw new ScriptError(
        `Refusing non-test PostgreSQL database: ${database.name}`,
        ScriptExitCode.SAFETY_GUARD,
      );
    }

    if (!allowUnsafe && redisDatabase <= 0) {
      throw new ScriptError(
        'TEST_REDIS_URL must select a dedicated Redis database greater than 0',
        ScriptExitCode.SAFETY_GUARD,
      );
    }

    adminClient = new Client({
      connectionString: database.adminUrl,
    });

    await adminClient.connect();

    const existing = await adminClient.query<{ exists: boolean }>(
      'SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1) AS exists',
      [database.name],
    );

    if (!existing.rows[0]?.exists) {
      await adminClient.query(
        `CREATE DATABASE ${quoteIdentifier(database.name)}`,
      );

      logger.info('created PostgreSQL test database', {
        database: database.name,
      });
    } else {
      logger.info('PostgreSQL test database already exists', {
        database: database.name,
      });
    }

    await adminClient.end();
    adminClient = undefined;

    const redisAttempts = 10;
    let redisReady = false;
    let lastRedisError: unknown;

    for (let attempt = 1; attempt <= redisAttempts; attempt += 1) {
      redis = new Redis(testRedisUrl, {
        lazyConnect: true,
        enableReadyCheck: true,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
      });

      redis.on('error', () => {
        /* Suppress unhandled ioredis error events during test prep check */
      });

      try {
        await redis.connect();
        await redis.ping();
        await redis.flushdb();

        logger.info('Redis test database is reachable and clean', {
          database: redisDatabase,
          attempt,
        });

        await redis.quit();
        redis = undefined;
        redisReady = true;
        break;
      } catch (error) {
        lastRedisError = error;
        redis?.disconnect(false);
        redis = undefined;

        logger.warn('Redis test instance is not ready', {
          attempt,
          attempts: redisAttempts,
        });

        if (attempt < redisAttempts) {
          await sleep(500);
        }
      }
    }

    if (!redisReady) {
      throw new ScriptError(
        'Redis test instance is not running or unreachable',
        ScriptExitCode.EXECUTION_ERROR,
        { cause: lastRedisError },
      );
    }

    logger.info('resetting and migrating the PostgreSQL test database');

    await runCommand({
      command: process.platform === 'win32' ? 'npx.cmd' : 'npx',
      args: [
        '--no-install',
        'prisma',
        'migrate',
        'reset',
        '--force',
        '--skip-seed',
        '--config',
        'prisma.config.ts',
      ],
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: 'test',
        DATABASE_URL: testDatabaseUrl,
      },
    });
  },

  async cleanup() {
    if (adminClient) {
      await adminClient.end();
      adminClient = undefined;
    }

    if (redis) {
      redis.disconnect(false);
      redis = undefined;
    }
  },
});

function parseDatabaseUrl(value: string): {
  adminUrl: string;
  name: string;
} {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new ScriptError(
      'TEST_DATABASE_URL is not a valid URL',
      ScriptExitCode.INVALID_ARGUMENT,
    );
  }

  const name = decodeURIComponent(url.pathname.replace(/^\//u, ''));

  if (!name) {
    throw new ScriptError(
      'TEST_DATABASE_URL must contain a database name',
      ScriptExitCode.INVALID_ARGUMENT,
    );
  }

  const adminUrl = new URL(url);
  adminUrl.pathname = '/postgres';
  adminUrl.searchParams.delete('schema');

  return {
    adminUrl: adminUrl.toString(),
    name,
  };
}

function parseRedisDatabase(value: string): number {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new ScriptError(
      'TEST_REDIS_URL is not a valid URL',
      ScriptExitCode.INVALID_ARGUMENT,
    );
  }

  const database = Number(url.pathname.replace(/^\//u, '') || '0');

  if (!Number.isSafeInteger(database) || database < 0) {
    throw new ScriptError(
      'TEST_REDIS_URL contains an invalid database number',
      ScriptExitCode.INVALID_ARGUMENT,
    );
  }

  return database;
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}
