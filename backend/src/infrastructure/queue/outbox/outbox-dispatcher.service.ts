import { randomUUID } from 'node:crypto';

import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type JobsOptions, Queue } from 'bullmq';
import { isAppException, QueueException } from '@/common/exceptions';
import { sanitizeCredentialUrls } from '@/common/utils';
import type { QueueConfig } from '@/config';
import { Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/infrastructure/database';
import { OutboxStatus } from '@/generated/prisma/enums';
import type { QueueTelemetryMetadata } from '@/common/interfaces/observability';
import {
  MANUAL_SPANS,
  MetricsService,
  TracePropagationService,
  TracingService,
} from '@/infrastructure/observability';

import { QUEUE_NAMES } from '../queue.constants';

const MAX_ERROR_LENGTH = 500;
const STALE_RECOVERY_ERROR = 'Recovered stale PROCESSING outbox event';
const DEFAULT_MAIL_JOB_RETENTION: QueueConfig['mailJobRetention'] = {
  completedAgeSeconds: 3600,
  completedCount: 100,

  failedAgeSeconds: 604_800,
  failedCount: 1000,
};

interface OutboxEventRow {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: unknown;
  metadata: unknown;
  status: OutboxStatus;
  attempts: number;
  availableAt: Date;
  processedAt: Date | null;
  processingStartedAt: Date | null;
  processingToken: string | null;
  lastError: string | null;
  createdAt: Date;
}

@Injectable()
export class OutboxDispatcherService {
  private readonly logger = new Logger(OutboxDispatcherService.name);
  private readonly maxAttempts: number;
  private readonly backoffMs: number;
  private readonly batchSize: number;
  private readonly processingTimeoutMs: number;
  private readonly mailJobRetention: QueueConfig['mailJobRetention'];

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @InjectQueue(QUEUE_NAMES.MAIL) private readonly mailQueue: Queue,
    private readonly metrics: MetricsService,
    private readonly tracing: TracingService,
    private readonly propagation: TracePropagationService,
  ) {
    const queueConfig = this.configService.get<QueueConfig>('queue');
    this.maxAttempts = queueConfig?.defaultAttempts ?? 3;
    this.backoffMs = queueConfig?.defaultBackoffMs ?? 5000;
    this.batchSize = queueConfig?.outboxBatchSize ?? 50;
    this.processingTimeoutMs = queueConfig?.outboxProcessingTimeoutMs ?? 60_000;
    this.mailJobRetention =
      queueConfig?.mailJobRetention ?? DEFAULT_MAIL_JOB_RETENTION;
  }

  async dispatchBatch(batchSize: number = this.batchSize): Promise<number> {
    return this.tracing.inSpan(
      MANUAL_SPANS.OUTBOX_DISPATCH_BATCH,
      { 'outbox.batch_size': Math.min(Math.max(batchSize, 1), 500) },
      () => this.dispatchBatchInternal(batchSize),
    );
  }

  private async dispatchBatchInternal(batchSize: number): Promise<number> {
    await this.recoverStaleEvents();
    const pendingEvents = await this.claimPendingEvents(batchSize);

    if (pendingEvents.length === 0) {
      return 0;
    }

    this.logger.debug({
      event: 'outbox.batch.started',
      'outbox.batch_size': pendingEvents.length,
    });

    let processedCount = 0;

    for (const event of pendingEvents) {
      const startedAt = performance.now();
      try {
        await this.publishEvent(event);
        if (await this.markPublished(event)) {
          processedCount++;
          this.metrics.recordOutbox(
            event.eventType,
            'success',
            (performance.now() - startedAt) / 1000,
          );
        } else {
          this.metrics.recordOutbox(
            event.eventType,
            'ownership_lost',
            (performance.now() - startedAt) / 1000,
          );
          this.logger.warn({
            event: 'outbox.finalize.ownership_lost',
            'outbox.event_id': event.id,
            'outbox.event_type': event.eventType,
          });
        }
      } catch (error: unknown) {
        const result = await this.handleFailure(event, error);
        this.metrics.recordOutbox(
          event.eventType,
          result === 'retried'
            ? 'retry'
            : result === 'ownership-lost'
              ? 'ownership_lost'
              : 'failed',
          (performance.now() - startedAt) / 1000,
        );
      }
    }

    this.logger.log({
      event: 'outbox.batch.completed',
      'outbox.result': 'success',
      published: processedCount,
      scanned: pendingEvents.length,
    });

    return processedCount;
  }

  private async claimPendingEvents(
    batchSize: number,
  ): Promise<OutboxEventRow[]> {
    const processingToken = randomUUID();

    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.$queryRaw<
        Array<{ id: string; processingToken: string }>
      >(Prisma.sql`
        WITH candidates AS (
          SELECT id
          FROM outbox_events
          WHERE status = 'pending'
            AND available_at <= NOW()
          ORDER BY available_at ASC
          FOR UPDATE SKIP LOCKED
          LIMIT ${Math.min(Math.max(batchSize, 1), 500)}
        )
        UPDATE outbox_events AS event
        SET
          status = 'processing',
          processing_started_at = NOW(),
          processing_token = ${processingToken}::uuid,
          processed_at = NULL
        FROM candidates
        WHERE event.id = candidates.id
        RETURNING event.id, event.processing_token AS "processingToken"
      `);

      if (claimed.length === 0) {
        return [];
      }

      const claimedIds = claimed.map(({ id }) => id);
      const events = await tx.outboxEvent.findMany({
        where: { id: { in: claimedIds } },
      });
      const byId = new Map(events.map((event) => [event.id, event]));
      const tokenById = new Map(
        claimed.map(({ id, processingToken: token }) => [id, token]),
      );
      return claimedIds.flatMap((id) => {
        const event = byId.get(id);
        const token = tokenById.get(id);
        return event && token ? [{ ...event, processingToken: token }] : [];
      });
    });
  }

  private async recoverStaleEvents(): Promise<void> {
    const now = new Date();
    const staleBefore = new Date(now.getTime() - this.processingTimeoutMs);
    const recovered = await this.prisma.outboxEvent.updateMany({
      where: {
        status: OutboxStatus.PROCESSING,
        processingStartedAt: { lte: staleBefore },
      },
      data: {
        status: OutboxStatus.PENDING,
        processingStartedAt: null,
        processingToken: null,
        availableAt: now,
        lastError: STALE_RECOVERY_ERROR,
      },
    });
    if (recovered.count > 0) {
      this.metrics.recordOutboxStaleRecovered(recovered.count);
      this.logger.warn({
        event: 'outbox.stale.recovered',
        recovered: recovered.count,
      });
    }
  }

  private async publishEvent(event: OutboxEventRow): Promise<void> {
    const targetQueue = this.resolveTargetQueue(event.aggregateType);

    if (!targetQueue) {
      throw new QueueException({
        code: 'OUTBOX_UNSUPPORTED_AGGREGATE_TYPE',
        message: `Unsupported outbox aggregate type: ${event.aggregateType}`,
        queue: QUEUE_NAMES.OUTBOX,
        operation: 'resolve-target-queue',
        jobId: event.id,
        retryable: false,
        details: {
          aggregateType: event.aggregateType,
          eventType: event.eventType,
        },
      });
    }

    const persistedMetadata = this.propagation.parse(event.metadata);
    const envelopeMetadata: QueueTelemetryMetadata = {
      schemaVersion: 1,
      source: 'worker',
      ...(persistedMetadata?.correlationId
        ? { correlationId: persistedMetadata.correlationId }
        : {}),
      causationId: event.id,
      ...(persistedMetadata?.traceId
        ? { traceId: persistedMetadata.traceId }
        : {}),
      ...(persistedMetadata?.traceContext
        ? { traceContext: persistedMetadata.traceContext }
        : {}),
    };

    await this.propagation.runWithExtractedContext(persistedMetadata, () =>
      this.tracing.inSpan(
        MANUAL_SPANS.OUTBOX_PUBLISH_EVENT,
        {
          'outbox.event_type': event.eventType,
          'outbox.aggregate_type': event.aggregateType,
        },
        async () => {
          await targetQueue.add(
            event.eventType,

            {
              aggregateType: event.aggregateType,

              aggregateId: event.aggregateId,

              eventType: event.eventType,

              payload: event.payload,

              outboxEventId: event.id,

              createdAt: event.createdAt.toISOString(),

              telemetry: envelopeMetadata,
            },

            {
              jobId: `outbox-${event.id}`,

              ...this.resolveJobRetention(event.aggregateType),
            },
          );
        },
      ),
    );
  }

  private resolveJobRetention(
    aggregateType: string,
  ): Pick<JobsOptions, 'removeOnComplete' | 'removeOnFail'> {
    if (aggregateType.toLowerCase() !== 'mail') {
      return {};
    }

    return {
      removeOnComplete: {
        age: this.mailJobRetention.completedAgeSeconds,

        count: this.mailJobRetention.completedCount,
      },

      removeOnFail: {
        age: this.mailJobRetention.failedAgeSeconds,

        count: this.mailJobRetention.failedCount,
      },
    };
  }

  private resolveTargetQueue(aggregateType: string): Queue | null {
    const queueMap: Record<string, Queue> = {
      mail: this.mailQueue,
    };

    return queueMap[aggregateType.toLowerCase()] ?? null;
  }

  private async markPublished(event: OutboxEventRow): Promise<boolean> {
    if (!event.processingToken) return false;

    const result = await this.prisma.outboxEvent.updateMany({
      where: {
        id: event.id,
        status: OutboxStatus.PROCESSING,
        processingToken: event.processingToken,
      },
      data: {
        status: OutboxStatus.PUBLISHED,
        processedAt: new Date(),
        processingStartedAt: null,
        processingToken: null,
        lastError: null,
      },
    });

    return result.count === 1;
  }

  private async handleFailure(
    event: OutboxEventRow,
    error: unknown,
  ): Promise<'retried' | 'failed' | 'ownership-lost'> {
    if (!event.processingToken) {
      this.logOwnershipLost(event.id, 'failure');
      return 'ownership-lost';
    }

    const nextAttempts = event.attempts + 1;
    const errorMessage = this.sanitizeError(error);
    const retryable = !isAppException(error) || error.retryable;

    this.logger.warn({
      event: 'outbox.event.failed',
      'outbox.event_id': event.id,
      'outbox.event_type': event.eventType,
      'outbox.attempt': nextAttempts,
      'outbox.result': retryable ? 'retry' : 'failed',
      error: errorMessage,
    });

    if (!retryable || nextAttempts >= this.maxAttempts) {
      const result = await this.prisma.outboxEvent.updateMany({
        where: {
          id: event.id,
          status: OutboxStatus.PROCESSING,
          processingToken: event.processingToken,
        },
        data: {
          status: OutboxStatus.FAILED,
          attempts: nextAttempts,
          lastError: errorMessage,
          processedAt: new Date(),
          processingStartedAt: null,
          processingToken: null,
        },
      });

      if (result.count !== 1) {
        this.logOwnershipLost(event.id, 'failure');
        return 'ownership-lost';
      }

      this.logger.error({
        event: 'outbox.event.dead_lettered',
        'outbox.event_id': event.id,
        'outbox.event_type': event.eventType,
        'outbox.attempt': nextAttempts,
      });
      return 'failed';
    } else {
      const nextAvailableAt = this.calculateBackoff(nextAttempts);

      const result = await this.prisma.outboxEvent.updateMany({
        where: {
          id: event.id,
          status: OutboxStatus.PROCESSING,
          processingToken: event.processingToken,
        },
        data: {
          status: OutboxStatus.PENDING,
          attempts: nextAttempts,
          lastError: errorMessage,
          availableAt: nextAvailableAt,
          processedAt: null,
          processingStartedAt: null,
          processingToken: null,
        },
      });

      if (result.count !== 1) {
        this.logOwnershipLost(event.id, 'failure');
        return 'ownership-lost';
      }

      return 'retried';
    }
  }

  private logOwnershipLost(eventId: string, operation: string): void {
    this.logger.warn({
      event: 'outbox.finalize.ownership_lost',
      'outbox.event_id': eventId,
      operation,
    });
  }

  private calculateBackoff(attempts: number): Date {
    const delayMs = this.backoffMs * Math.pow(2, attempts - 1);
    return new Date(Date.now() + delayMs);
  }

  private sanitizeError(error: unknown): string {
    if (error instanceof Error) {
      return sanitizeCredentialUrls(error.message).slice(0, MAX_ERROR_LENGTH);
    }

    return sanitizeCredentialUrls(String(error)).slice(0, MAX_ERROR_LENGTH);
  }
}
