import { hasFlag } from '../shared/script-arguments';
import {
  assertNotProduction,
  isLikelyLocalDatabase,
  parseDatabaseTarget,
  requireEnvironmentVariable,
} from '../shared/environment';
import { ScriptError, ScriptExitCode } from '../shared/script-error';
import { runCommand } from '../shared/process-command';
import { runScript } from '../shared/script-runner';

void runScript({
  name: 'reset-local-database',

  async execute({ logger }) {
    assertNotProduction('Database reset');

    if (!hasFlag('confirm-reset')) {
      throw new ScriptError(
        'Refusing to reset database without --confirm-reset',
        ScriptExitCode.SAFETY_GUARD,
      );
    }

    const databaseUrl = requireEnvironmentVariable('DATABASE_URL');
    const target = parseDatabaseTarget(databaseUrl);

    if (
      !isLikelyLocalDatabase(databaseUrl) &&
      !hasFlag('allow-remote-non-production')
    ) {
      throw new ScriptError(
        'Refusing to reset a non-local database. ' +
          'Use --allow-remote-non-production only for an isolated test database.',
        ScriptExitCode.SAFETY_GUARD,
      );
    }

    logger.warn('database will be reset', {
      host: target.host,
      port: target.port,
      database: target.database,
    });

    // npm scripts are executed with backend/ as the working directory.
    const backendRoot = process.cwd();

    await runCommand({
      command: 'npx',
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
      cwd: backendRoot,
    });

    await runCommand({
      command: 'npx',
      args: ['--no-install', 'tsx', 'prisma/seed.ts'],
      cwd: backendRoot,
    });

    logger.info('database reset and seed completed');
  },
});
