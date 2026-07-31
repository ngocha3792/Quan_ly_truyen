import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';

import type { QueueConfig } from '@/config';
import { PrismaService } from '@/infrastructure/database';
import { OutboxStatus } from '@/generated/prisma/enums';

import { QUEUE_NAMES } from '../queue.constants';

const DEFAULT_BATCH_SIZE = 50;
const MAX_ERROR_LENGTH = 500;

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
  lastError: string | null;
  createdAt: Date;
}

@Injectable()
export class OutboxDispatcherService {
  private readonly logger = new Logger(OutboxDispatcherService.name);
  private readonly maxAttempts: number;
  private readonly backoffMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @InjectQueue(QUEUE_NAMES.OUTBOX)
    private readonly outboxQueue: Queue,
  ) {
    const queueConfig = this.configService.get<QueueConfig>('queue');
    this.maxAttempts = queueConfig?.defaultAttempts ?? 3;
    this.backoffMs = queueConfig?.defaultBackoffMs ?? 5000;
  }

  async dispatchBatch(batchSize: number = DEFAULT_BATCH_SIZE): Promise<number> {
    const pendingEvents = await this.claimPendingEvents(batchSize);

    if (pendingEvents.length === 0) {
      return 0;
    }

    this.logger.debug(`Processing ${pendingEvents.length} outbox events`);

    let processedCount = 0;

    for (const event of pendingEvents) {
      try {
        await this.publishEvent(event);
        await this.markPublished(event.id);
        processedCount++;
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
    const now = new Date();

    // Atomic claim: only transition PENDING → PROCESSING rows
    // Using a transaction with findMany + updateMany to avoid race conditions
    return this.prisma.$transaction(async (tx) => {
      const events = await tx.outboxEvent.findMany({
        where: {
          status: OutboxStatus.PENDING,
          availableAt: { lte: now },
        },
        orderBy: { availableAt: 'asc' },
        take: batchSize,
      });

      if (events.length === 0) {
        return [];
      }

      const eventIds = events.map((e) => e.id);

      await tx.outboxEvent.updateMany({
        where: {
          id: { in: eventIds },
          status: OutboxStatus.PENDING, // Optimistic check
        },
        data: { status: OutboxStatus.PROCESSING },
      });

      return events.map((e) => ({ ...e, status: OutboxStatus.PROCESSING }));
    });
  }

  private async publishEvent(event: OutboxEventRow): Promise<void> {
    const targetQueue = this.resolveTargetQueue(event.aggregateType);

    if (targetQueue) {
      await targetQueue.add(event.eventType, {
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        eventType: event.eventType,
        payload: event.payload,
        outboxEventId: event.id,
        createdAt: event.createdAt.toISOString(),
      });
    } else {
      this.logger.warn(
        `No target queue for aggregate type "${event.aggregateType}", marking as published (noop)`,
      );
    }
  }

  private resolveTargetQueue(aggregateType: string): Queue | null {
    // Map aggregate types to their respective queues
    const queueMap: Record<string, Queue> = {
      media: this.outboxQueue,
      mail: this.outboxQueue,
      notification: this.outboxQueue,
      story: this.outboxQueue,
      analytics: this.outboxQueue,
    };

    return queueMap[aggregateType.toLowerCase()] ?? null;
  }

  private async markPublished(eventId: string): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id: eventId },
      data: {
        status: OutboxStatus.PUBLISHED,
        processedAt: new Date(),
      },
    });
  }

  private async handleFailure(
    event: OutboxEventRow,
    error: unknown,
  ): Promise<void> {
    const nextAttempts = event.attempts + 1;
    const errorMessage = this.sanitizeError(error);

    this.logger.warn(
      `Outbox event ${event.id} failed (attempt ${nextAttempts}/${this.maxAttempts}): ${errorMessage}`,
    );

    if (nextAttempts >= this.maxAttempts) {
      await this.prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: OutboxStatus.FAILED,
          attempts: nextAttempts,
          lastError: errorMessage,
          processedAt: new Date(),
        },
      });

      this.logger.error(
        `Outbox event ${event.id} permanently failed after ${nextAttempts} attempts`,
      );
    } else {
      const nextAvailableAt = this.calculateBackoff(nextAttempts);

      await this.prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: OutboxStatus.PENDING,
          attempts: nextAttempts,
          lastError: errorMessage,
          availableAt: nextAvailableAt,
        },
      });
    }
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
