import { Injectable } from '@nestjs/common';

import { OutboxStatus, type Prisma } from '@/generated/prisma/client';

import type { CreateOutboxEventInput } from './outbox.types';

@Injectable()
export class OutboxWriterService {
  create(
    tx: Prisma.TransactionClient,
    input: CreateOutboxEventInput,
  ): Promise<{ id: string }> {
    return tx.outboxEvent.create({
      data: {
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        eventType: input.eventType,
        payload: input.payload,
        status: OutboxStatus.PENDING,
        availableAt: input.availableAt ?? new Date(),
      },
      select: { id: true },
    });
  }
}
