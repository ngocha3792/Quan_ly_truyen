import { Injectable } from '@nestjs/common';

import { Prisma } from '@/generated/prisma/client';

import { OutboxStatus } from '@/generated/prisma/enums';

import { PrismaService } from '@/infrastructure/database';

import { SEND_MAIL_JOB } from '../contracts';

const HOUR_MS = 60 * 60 * 1000;

const DAY_MS = 24 * HOUR_MS;

const MAX_BATCH_SIZE = 500;

const MAIL_AGGREGATE_TYPE = 'mail';

const REDACTION_REASON = 'mail-outbox-retention';

export interface CleanupOutboxOptions {
  apply: boolean;

  batchSize: number;

  redactAfterHours: number;

  publishedRetentionDays: number;

  failedRetentionDays: number;

  /**
   * Chỉ truyền trong test.
   */
  now?: Date;
}

export interface OutboxCleanupCounts {
  publishedDeleted: number;

  failedDeleted: number;

  publishedRedacted: number;
}

export interface OutboxCleanupSummary {
  mode: 'dry-run' | 'apply';

  batchSize: number;

  cutoffs: {
    redactBefore: string;

    deletePublishedBefore: string;

    deleteFailedBefore: string;
  };

  planned: OutboxCleanupCounts;

  applied: OutboxCleanupCounts;
}

interface CandidateId {
  id: string;
}

@Injectable()
export class OutboxRetentionService {
  constructor(private readonly prisma: PrismaService) {}

  async cleanup(options: CleanupOutboxOptions): Promise<OutboxCleanupSummary> {
    validateOptions(options);

    const now = options.now ? new Date(options.now) : new Date();

    const redactBefore = new Date(
      now.getTime() - options.redactAfterHours * HOUR_MS,
    );

    const deletePublishedBefore = new Date(
      now.getTime() - options.publishedRetentionDays * DAY_MS,
    );

    const deleteFailedBefore = new Date(
      now.getTime() - options.failedRetentionDays * DAY_MS,
    );

    /*
     * Delete cutoff phải cũ hơn redact
     * cutoff để có một khoảng thời gian
     * giữ record đã redact.
     */
    if (deletePublishedBefore.getTime() >= redactBefore.getTime()) {
      throw new RangeError(
        'publishedRetentionDays must be longer than redactAfterHours',
      );
    }

    const [
      publishedDeleteCandidates,

      failedDeleteCandidates,

      redactionCandidates,
    ] = await Promise.all([
      this.findPublishedDeleteCandidates(
        deletePublishedBefore,
        options.batchSize,
      ),

      this.findFailedDeleteCandidates(deleteFailedBefore, options.batchSize),

      this.findRedactionCandidates(
        deletePublishedBefore,
        redactBefore,
        options.batchSize,
      ),
    ]);

    const planned: OutboxCleanupCounts = {
      publishedDeleted: publishedDeleteCandidates.length,

      failedDeleted: failedDeleteCandidates.length,

      publishedRedacted: redactionCandidates.length,
    };

    if (!options.apply) {
      return {
        mode: 'dry-run',

        batchSize: options.batchSize,

        cutoffs: {
          redactBefore: redactBefore.toISOString(),

          deletePublishedBefore: deletePublishedBefore.toISOString(),

          deleteFailedBefore: deleteFailedBefore.toISOString(),
        },

        planned,

        applied: emptyCounts(),
      };
    }

    const applied = await this.prisma.$transaction(async (tx) => {
      const publishedDeleted =
        publishedDeleteCandidates.length === 0
          ? 0
          : (
              await tx.outboxEvent.deleteMany({
                where: {
                  id: {
                    in: publishedDeleteCandidates.map(({ id }) => id),
                  },

                  aggregateType: MAIL_AGGREGATE_TYPE,

                  eventType: SEND_MAIL_JOB,

                  status: OutboxStatus.PUBLISHED,

                  processedAt: {
                    lt: deletePublishedBefore,
                  },
                },
              })
            ).count;

      const failedDeleted =
        failedDeleteCandidates.length === 0
          ? 0
          : (
              await tx.outboxEvent.deleteMany({
                where: {
                  id: {
                    in: failedDeleteCandidates.map(({ id }) => id),
                  },

                  aggregateType: MAIL_AGGREGATE_TYPE,

                  eventType: SEND_MAIL_JOB,

                  status: OutboxStatus.FAILED,

                  processedAt: {
                    lt: deleteFailedBefore,
                  },
                },
              })
            ).count;

      const publishedRedacted =
        redactionCandidates.length === 0
          ? 0
          : (
              await tx.outboxEvent.updateMany({
                where: {
                  id: {
                    in: redactionCandidates.map(({ id }) => id),
                  },

                  aggregateType: MAIL_AGGREGATE_TYPE,

                  eventType: SEND_MAIL_JOB,

                  status: OutboxStatus.PUBLISHED,

                  processedAt: {
                    gte: deletePublishedBefore,

                    lt: redactBefore,
                  },
                },

                data: {
                  payload: createRedactedPayload(now),
                },
              })
            ).count;

      return {
        publishedDeleted,

        failedDeleted,

        publishedRedacted,
      };
    });

    return {
      mode: 'apply',

      batchSize: options.batchSize,

      cutoffs: {
        redactBefore: redactBefore.toISOString(),

        deletePublishedBefore: deletePublishedBefore.toISOString(),

        deleteFailedBefore: deleteFailedBefore.toISOString(),
      },

      planned,

      applied,
    };
  }

  private findPublishedDeleteCandidates(
    cutoff: Date,

    batchSize: number,
  ): Promise<CandidateId[]> {
    return this.prisma.$queryRaw<CandidateId[]>(Prisma.sql`
      SELECT id
      FROM outbox_events
      WHERE aggregate_type =
        ${MAIL_AGGREGATE_TYPE}
        AND event_type =
          ${SEND_MAIL_JOB}
        AND status = 'published'
        AND processed_at < ${cutoff}
      ORDER BY
        processed_at ASC,
        id ASC
      LIMIT ${batchSize}
    `);
  }

  private findFailedDeleteCandidates(
    cutoff: Date,

    batchSize: number,
  ): Promise<CandidateId[]> {
    return this.prisma.$queryRaw<CandidateId[]>(Prisma.sql`
      SELECT id
      FROM outbox_events
      WHERE aggregate_type =
        ${MAIL_AGGREGATE_TYPE}
        AND event_type =
          ${SEND_MAIL_JOB}
        AND status = 'failed'
        AND processed_at < ${cutoff}
      ORDER BY
        processed_at ASC,
        id ASC
      LIMIT ${batchSize}
    `);
  }

  private findRedactionCandidates(
    deleteCutoff: Date,

    redactCutoff: Date,

    batchSize: number,
  ): Promise<CandidateId[]> {
    return this.prisma.$queryRaw<CandidateId[]>(Prisma.sql`
      SELECT id
      FROM outbox_events
      WHERE aggregate_type =
        ${MAIL_AGGREGATE_TYPE}
        AND event_type =
          ${SEND_MAIL_JOB}
        AND status = 'published'
        AND processed_at >=
          ${deleteCutoff}
        AND processed_at <
          ${redactCutoff}
        AND (
          payload ->> 'redacted'
        ) IS DISTINCT FROM 'true'
      ORDER BY
        processed_at ASC,
        id ASC
      LIMIT ${batchSize}
    `);
  }
}

function createRedactedPayload(now: Date): Prisma.InputJsonObject {
  /*
   * Không giữ ciphertext, IV, auth tag,
   * email, template variables hoặc token URL.
   */
  return {
    version: 1,

    redacted: true,

    reason: REDACTION_REASON,

    redactedAt: now.toISOString(),
  };
}

function validateOptions(options: CleanupOutboxOptions): void {
  assertPositiveInteger(options.batchSize, 'batchSize');

  assertPositiveInteger(options.redactAfterHours, 'redactAfterHours');

  assertPositiveInteger(
    options.publishedRetentionDays,
    'publishedRetentionDays',
  );

  assertPositiveInteger(options.failedRetentionDays, 'failedRetentionDays');

  if (options.batchSize > MAX_BATCH_SIZE) {
    throw new RangeError(`batchSize cannot exceed ${MAX_BATCH_SIZE}`);
  }
}

function assertPositiveInteger(
  value: number,

  name: string,
): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive integer`);
  }
}

function emptyCounts(): OutboxCleanupCounts {
  return {
    publishedDeleted: 0,

    failedDeleted: 0,

    publishedRedacted: 0,
  };
}
