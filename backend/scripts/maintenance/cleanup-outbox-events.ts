import type { INestApplicationContext } from '@nestjs/common';

import { NestFactory } from '@nestjs/core';

import { OutboxRetentionService } from '@/infrastructure/queue/outbox';
import { recordMaintenanceSuccess } from '../shared/maintenance-heartbeat';
import { OutboxRetentionCommandModule } from '@/maintenance/outbox-retention-command.module';

import { hasFlag, readPositiveInteger } from '../shared/script-arguments';

import { runScript } from '../shared/script-runner';

let app: INestApplicationContext | undefined;

void runScript({
  name: 'cleanup-outbox-events',

  async execute({ logger }) {
    const apply = hasFlag('apply');

    const batchSize = readPositiveInteger('batch-size', 500);

    const redactAfterHours = readPositiveInteger('redact-after-hours', 24);

    const publishedRetentionDays = readPositiveInteger(
      'published-retention-days',
      30,
    );

    const failedRetentionDays = readPositiveInteger(
      'failed-retention-days',
      90,
    );

    app = await NestFactory.createApplicationContext(
      OutboxRetentionCommandModule,

      {
        logger: ['error', 'warn'],
      },
    );

    const service = app.get(OutboxRetentionService);

    const summary = await service.cleanup({
      apply,

      batchSize,

      redactAfterHours,

      publishedRetentionDays,

      failedRetentionDays,
    });

    logger.info('outbox cleanup plan', {
      mode: summary.mode,

      batchSize: summary.batchSize,

      redactBefore: summary.cutoffs.redactBefore,

      deletePublishedBefore: summary.cutoffs.deletePublishedBefore,

      deleteFailedBefore: summary.cutoffs.deleteFailedBefore,

      plannedPublishedRedacted: summary.planned.publishedRedacted,

      plannedPublishedDeleted: summary.planned.publishedDeleted,

      plannedFailedDeleted: summary.planned.failedDeleted,
    });

    if (!apply) {
      logger.info('dry-run completed; pass --apply to mutate records');

      return;
    }
    await recordMaintenanceSuccess('outbox-cleanup');
    logger.info('outbox cleanup applied', {
      publishedRedacted: summary.applied.publishedRedacted,

      publishedDeleted: summary.applied.publishedDeleted,

      failedDeleted: summary.applied.failedDeleted,
    });
  },

  cleanup: async () => {
    if (app) {
      await app.close();
    }
  },
});
