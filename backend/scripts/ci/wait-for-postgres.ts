import { setTimeout as sleep } from 'node:timers/promises';

import { createScriptPrismaClient } from '../shared/prisma-client';
import { readPositiveInteger } from '../shared/script-arguments';
import { ScriptError, ScriptExitCode } from '../shared/script-error';
import { runScript } from '../shared/script-runner';

const prisma = createScriptPrismaClient();

void runScript({
  name: 'wait-for-postgres',

  async execute({ logger }) {
    const attempts = readPositiveInteger('attempts', 30);
    const intervalMs = readPositiveInteger('interval-ms', 2000);

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        await prisma.$queryRaw`SELECT 1`;

        logger.info('postgres is ready', {
          attempt,
        });

        return;
      } catch {
        logger.warn('postgres is not ready', {
          attempt,
          attempts,
        });

        if (attempt < attempts) {
          await sleep(intervalMs);
        }
      }
    }

    throw new ScriptError(
      'PostgreSQL did not become ready in time',
      ScriptExitCode.EXECUTION_ERROR,
    );
  },

  cleanup: () => prisma.$disconnect(),
});
