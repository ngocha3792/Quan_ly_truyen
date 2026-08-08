import { Client } from 'pg';

import {
  assertNotProduction,
  requireEnvironmentVariable,
} from '../shared/environment';

import { runCommand } from '../shared/process-command';

import { ScriptError, ScriptExitCode } from '../shared/script-error';

import { runScript } from '../shared/script-runner';

let adminClient: Client | undefined;

void runScript({
  name: 'prepare-postgres-test-environment',

  async execute({ logger }) {
    assertNotProduction('Preparing the PostgreSQL test environment');

    const testDatabaseUrl = requireEnvironmentVariable('TEST_DATABASE_URL');

    const allowUnsafe = process.env.ALLOW_UNSAFE_TEST_DB === 'true';

    const database = parseDatabaseUrl(testDatabaseUrl);

    if (!allowUnsafe && !/(^|[_-])test($|[_-])/u.test(database.name)) {
      throw new ScriptError(
        `Refusing non-test PostgreSQL database: ${database.name}`,

        ScriptExitCode.SAFETY_GUARD,
      );
    }

    adminClient = new Client({
      connectionString: database.adminUrl,
    });

    await adminClient.connect();

    const existing = await adminClient.query<{
      exists: boolean;
    }>(
      `
          SELECT EXISTS(
            SELECT 1
            FROM pg_database
            WHERE datname = $1
          ) AS exists
        `,

      [database.name],
    );

    if (!existing.rows[0]?.exists) {
      await adminClient.query(
        `CREATE DATABASE ${quoteIdentifier(database.name)}`,
      );

      logger.info(
        'created PostgreSQL test database',

        {
          database: database.name,
        },
      );
    } else {
      logger.info(
        'PostgreSQL test database already exists',

        {
          database: database.name,
        },
      );
    }

    await adminClient.end();

    adminClient = undefined;

    logger.info('applying Prisma migrations to the test database');

    await runCommand({
      command: process.platform === 'win32' ? 'npm.cmd' : 'npm',

      args: ['run', 'db:migrate:deploy'],

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

  const name = decodeURIComponent(
    url.pathname.replace(
      /^\//u,

      '',
    ),
  );

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

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll(
    '"',

    '""',
  )}"`;
}
