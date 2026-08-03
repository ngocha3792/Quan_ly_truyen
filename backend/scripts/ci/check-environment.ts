import 'dotenv/config';

import { validateEnvironment } from '../../src/config';

import {
  parseDatabaseTarget,
  requireEnvironmentVariable,
} from '../shared/environment';

import { runScript } from '../shared/script-runner';

void runScript({
  name: 'check-environment',

  execute({ logger }) {
    /*
     * Dùng chính validator mà Nest bootstrap dùng.
     *
     * Không duy trì một danh sách env riêng trong
     * script vì rất dễ bị lệch.
     */
    validateEnvironment(process.env);

    const target = parseDatabaseTarget(
      requireEnvironmentVariable('DATABASE_URL'),
    );

    const appUrl = new URL(requireEnvironmentVariable('APP_PUBLIC_URL'));

    logger.info(
      'environment is valid',

      {
        nodeEnv: process.env.NODE_ENV,

        applicationHost: appUrl.hostname,

        databaseHost: target.host,

        databasePort: target.port,

        databaseName: target.database,

        redisEnabled: process.env.REDIS_ENABLED === 'true',

        queueEnabled: process.env.QUEUE_ENABLED === 'true',

        mailEnabled: process.env.MAIL_ENABLED === 'true',
      },
    );

    return Promise.resolve();
  },
});
