import { createScriptPrismaClient } from '../shared/prisma-client';
import { runScript } from '../shared/script-runner';

const prisma = createScriptPrismaClient();

void runScript({
  name: 'check-database-connection',

  async execute({ logger }) {
    const result = await prisma.$queryRaw<
      Array<{
        database_name: string;
        server_time: Date;
      }>
    >`
      SELECT
        current_database() AS database_name,
        NOW() AS server_time
    `;

    const row = result[0];

    logger.info('database connection succeeded', {
      databaseName: row?.database_name ?? 'unknown',
      serverTime: row?.server_time?.toISOString() ?? 'unknown',
    });
  },

  cleanup: () => prisma.$disconnect(),
});
