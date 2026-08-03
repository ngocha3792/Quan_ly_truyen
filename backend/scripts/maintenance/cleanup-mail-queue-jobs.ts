import { Queue } from 'bullmq';

import { createRedisConnectionOptions } from '@/infrastructure/cache/redis';

import { QUEUE_NAMES } from '@/infrastructure/queue';

import { hasFlag, readPositiveInteger } from '../shared/script-arguments';

import { requireEnvironmentVariable } from '../shared/environment';

import { runScript } from '../shared/script-runner';

import { recordMaintenanceSuccess } from '../shared/maintenance-heartbeat';

type FinalizedJobState = 'completed' | 'failed';

let mailQueue: Queue | undefined;

void runScript({
  name: 'cleanup-mail-queue-jobs',

  async execute({ logger }) {
    const apply = hasFlag('apply');

    const batchSize = readPositiveInteger('batch-size', 500);

    const completedRetentionSeconds = readPositiveInteger(
      'completed-retention-seconds',
      3600,
    );

    const failedRetentionSeconds = readPositiveInteger(
      'failed-retention-seconds',
      604_800,
    );

    const redisUrl = requireEnvironmentVariable('REDIS_URL');

    const prefix = process.env.QUEUE_PREFIX?.trim() || 'qlt';

    const connectTimeout = Number(process.env.REDIS_CONNECT_TIMEOUT_MS ?? 5000);

    mailQueue = new Queue(
      QUEUE_NAMES.MAIL,

      {
        prefix,

        connection: createRedisConnectionOptions(
          redisUrl,

          {
            connectTimeout,

            maxRetriesPerRequest: null,
          },
        ),
      },
    );

    await mailQueue.waitUntilReady();

    if (!apply) {
      const now = Date.now();

      const [completedCandidates, failedCandidates] = await Promise.all([
        countOldJobs(
          mailQueue,

          'completed',

          now - completedRetentionSeconds * 1000,

          batchSize,
        ),

        countOldJobs(
          mailQueue,

          'failed',

          now - failedRetentionSeconds * 1000,

          batchSize,
        ),
      ]);

      logger.info('mail queue cleanup plan', {
        mode: 'dry-run',

        queue: QUEUE_NAMES.MAIL,

        prefix,

        batchSize,

        completedRetentionSeconds,

        failedRetentionSeconds,

        completedCandidates,

        failedCandidates,
      });

      logger.info('dry-run completed; pass --apply to remove jobs');

      return;
    }

    /*
     * Queue.clean grace sử dụng milliseconds.
     */
    const completedDeleted = await mailQueue.clean(
      completedRetentionSeconds * 1000,

      batchSize,

      'completed',
    );

    const failedDeleted = await mailQueue.clean(
      failedRetentionSeconds * 1000,

      batchSize,

      'failed',
    );
    await recordMaintenanceSuccess('mail-queue-cleanup');

    logger.info('mail queue cleanup applied', {
      queue: QUEUE_NAMES.MAIL,

      prefix,

      batchSize,

      completedDeleted: completedDeleted.length,

      failedDeleted: failedDeleted.length,
    });
  },

  cleanup: async () => {
    if (mailQueue) {
      await mailQueue.close();
    }
  },
});

async function countOldJobs(
  queue: Queue,

  state: FinalizedJobState,

  cutoffTimestamp: number,

  batchSize: number,
): Promise<number> {
  /*
   * asc=true: lấy job cũ nhất trước.
   * Không log job.data vì có thể chứa
   * encrypted mail payload.
   */
  const jobs = await queue.getJobs(
    state,

    0,

    batchSize - 1,

    true,
  );

  return jobs.filter(
    (job) =>
      typeof job.finishedOn === 'number' && job.finishedOn < cutoffTimestamp,
  ).length;
}
