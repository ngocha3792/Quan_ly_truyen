import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const MIGRATION_DIRECTORY_PATTERN = /^\d{14}(?:_[a-z0-9][a-z0-9_]*)?$/;
const MIGRATION_TIMESTAMP_PATTERN = /^(\d{14})/;

function fail(message: string): never {
  throw new Error(`[database-validation] ${message}`);
}

async function main(): Promise<void> {
  const migrationsRoot = resolve(process.cwd(), 'prisma', 'migrations');
  const lockFile = resolve(migrationsRoot, 'migration_lock.toml');

  const lockContents = await readFile(lockFile, 'utf8');
  if (!/^provider\s*=\s*"postgresql"\s*$/m.test(lockContents)) {
    fail('prisma/migrations/migration_lock.toml must target postgresql');
  }

  const entries = await readdir(migrationsRoot, { withFileTypes: true });
  const migrationDirectories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  if (migrationDirectories.length === 0) {
    fail('no Prisma migration directories were found');
  }

  const timestamps = new Set<string>();

  for (const directory of migrationDirectories) {
    if (!MIGRATION_DIRECTORY_PATTERN.test(directory)) {
      fail(
        `invalid migration directory "${directory}"; expected YYYYMMDDHHMMSS[_description]`,
      );
    }

    const timestamp = MIGRATION_TIMESTAMP_PATTERN.exec(directory)?.[1];
    if (!timestamp) {
      fail(`migration "${directory}" does not contain a valid timestamp`);
    }

    if (timestamps.has(timestamp)) {
      fail(`duplicate migration timestamp detected: ${timestamp}`);
    }
    timestamps.add(timestamp);

    const migrationSql = resolve(migrationsRoot, directory, 'migration.sql');
    let migrationStats: Awaited<ReturnType<typeof stat>>;
    try {
      migrationStats = await stat(migrationSql);
    } catch {
      fail(`migration "${directory}" is missing migration.sql`);
    }

    if (!migrationStats.isFile() || migrationStats.size === 0) {
      fail(`migration "${directory}" has an empty migration.sql`);
    }

    const sql = await readFile(migrationSql, 'utf8');
    if (sql.includes('\u0000')) {
      fail(`migration "${directory}" contains NUL bytes`);
    }
  }

  console.log(
    `[database-validation] ${migrationDirectories.length} migration directories validated`,
  );
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
