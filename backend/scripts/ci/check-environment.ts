import 'dotenv/config';

import {
  parseDatabaseTarget,
  requireEnvironmentVariable,
} from '../shared/environment';
import { runScript } from '../shared/script-runner';

void runScript({
  name: 'check-environment',

  async execute({ logger }) {
    await Promise.resolve();
    const requiredVariables = ['DATABASE_URL', 'NODE_ENV'] as const;

    for (const name of requiredVariables) {
      requireEnvironmentVariable(name);
    }

    const target = parseDatabaseTarget(
      requireEnvironmentVariable('DATABASE_URL'),
    );

    logger.info('environment is valid', {
      nodeEnv: process.env.NODE_ENV,
      databaseHost: target.host,
      databasePort: target.port,
      databaseName: target.database,
    });
  },
});
