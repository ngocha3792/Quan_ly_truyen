import { Injectable } from '@nestjs/common';

import { OutboxStatus, type Prisma } from '@/generated/prisma/client';
import { TracePropagationService } from '@/infrastructure/observability';

import type { CreateOutboxEventInput } from './outbox.types';

@Injectable()
export class OutboxWriterService {
  constructor(private readonly propagation: TracePropagationService) {}

  create(
    tx: Prisma.TransactionClient,
    input: CreateOutboxEventInput,
  ): Promise<{ id: string }> {
    const metadata =
      input.metadata ??
      this.propagation.capture({
        source: 'api',
        causationId: input.causationId,
      });
    return tx.outboxEvent.create({
      data: {
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        eventType: input.eventType,
        idempotencyKey: input.idempotencyKey,
        payload: input.payload,
        metadata: metadata as unknown as Prisma.InputJsonObject,
        status: OutboxStatus.PENDING,
        availableAt: input.availableAt ?? new Date(),
      },
      select: { id: true },
    });
  }
}
