import { randomUUID } from 'node:crypto';

import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';

import { isAppException, QueueException } from '@/common/exceptions';
import type { QueueConfig } from '@/config';
import { Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/infrastructure/database';
import { OutboxStatus } from '@/generated/prisma/enums';

import { QUEUE_NAMES } from '../queue.constants';

const MAX_ERROR_LENGTH = 500;
const STALE_RECOVERY_ERROR = 'Recovered stale PROCESSING outbox event';

interface OutboxEventRow {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: unknown;
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

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @InjectQueue(QUEUE_NAMES.MAIL) private readonly mailQueue: Queue,
  ) {
    const queueConfig = this.configService.get<QueueConfig>('queue');
    this.maxAttempts = queueConfig?.defaultAttempts ?? 3;
    this.backoffMs = queueConfig?.defaultBackoffMs ?? 5000;
    this.batchSize = queueConfig?.outboxBatchSize ?? 50;
    this.processingTimeoutMs = queueConfig?.outboxProcessingTimeoutMs ?? 60_000;
  }

  async dispatchBatch(batchSize: number = this.batchSize): Promise<number> {
    await this.recoverStaleEvents();
    const pendingEvents = await this.claimPendingEvents(batchSize);

    if (pendingEvents.length === 0) {
      return 0;
    }

    this.logger.debug(`Processing ${pendingEvents.length} outbox events`);

    let processedCount = 0;

    for (const event of pendingEvents) {
      try {
        await this.publishEvent(event);
        if (await this.markPublished(event)) {
          processedCount++;
        } else {
          this.logger.warn(
            `Outbox ownership lost before publish finalization for event ${event.id}`,
          );
        }
      } catch (error: unknown) {
        await this.handleFailure(event, error);
      }
    }

    this.logger.log(
      `Outbox batch completed: ${processedCount}/${pendingEvents.length} published`,
    );

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
      this.logger.warn(`Recovered ${recovered.count} stale outbox events`);
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

    await targetQueue.add(
      event.eventType,
      {
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        eventType: event.eventType,
        payload: event.payload,
        outboxEventId: event.id,
        createdAt: event.createdAt.toISOString(),
      },
      { jobId: `outbox-${event.id}` },
    );
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

    this.logger.warn(
      `Outbox event ${event.id} failed (attempt ${nextAttempts}/${this.maxAttempts}): ${errorMessage}`,
    );

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

      this.logger.error(
        `Outbox event ${event.id} permanently failed after ${nextAttempts} attempts`,
      );
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
    this.logger.warn(
      `Outbox ownership lost before ${operation} finalization for event ${eventId}`,
    );
  }

  private calculateBackoff(attempts: number): Date {
    const delayMs = this.backoffMs * Math.pow(2, attempts - 1);
    return new Date(Date.now() + delayMs);
  }

  private sanitizeError(error: unknown): string {
    if (error instanceof Error) {
      return error.message.slice(0, MAX_ERROR_LENGTH);
    }

    return String(error).slice(0, MAX_ERROR_LENGTH);
  }
}
