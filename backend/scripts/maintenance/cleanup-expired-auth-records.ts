import { hasFlag, readPositiveInteger } from '../shared/script-arguments';
import { createScriptPrismaClient } from '../shared/prisma-client';
import { runScript } from '../shared/script-runner';
import { recordMaintenanceSuccess } from '../shared/maintenance-heartbeat';
const prisma = createScriptPrismaClient();

void runScript({
  name: 'cleanup-expired-auth-records',

  async execute({ logger }) {
    const apply = hasFlag('apply');
    const batchSize = readPositiveInteger('batch-size', 500);
    const retentionDays = readPositiveInteger('retention-days', 30);

    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    const expiredSessions = await prisma.session.findMany({
      where: {
        OR: [
          {
            expiresAt: {
              lt: cutoff,
            },
          },
          {
            revokedAt: {
              lt: cutoff,
            },
          },
        ],
      },
      select: {
        id: true,
      },
      take: batchSize,
      orderBy: {
        createdAt: 'asc',
      },
    });

    const expiredTokens = await prisma.userToken.findMany({
      where: {
        OR: [
          {
            expiresAt: {
              lt: cutoff,
            },
          },
          {
            consumedAt: {
              lt: cutoff,
            },
          },
        ],
      },
      select: {
        id: true,
      },
      take: batchSize,
      orderBy: {
        createdAt: 'asc',
      },
    });

    logger.info('expired auth records found', {
      mode: apply ? 'apply' : 'dry-run',
      cutoff: cutoff.toISOString(),
      sessions: expiredSessions.length,
      tokens: expiredTokens.length,
      batchSize,
    });

    if (!apply) {
      return;
    }

    await prisma.$transaction([
      prisma.session.deleteMany({
        where: {
          id: {
            in: expiredSessions.map(({ id }) => id),
          },
        },
      }),

      prisma.userToken.deleteMany({
        where: {
          id: {
            in: expiredTokens.map(({ id }) => id),
          },
        },
      }),
    ]);

    await recordMaintenanceSuccess('auth-cleanup');
  },

  cleanup: () => prisma.$disconnect(),
});
