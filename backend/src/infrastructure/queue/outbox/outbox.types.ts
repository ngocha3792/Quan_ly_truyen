import type { Prisma } from '@/generated/prisma/client';
import type { QueueTelemetryMetadata } from '@/common/interfaces/observability';

export interface CreateOutboxEventInput {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Prisma.InputJsonValue;
  availableAt?: Date;
  idempotencyKey?: string;
  causationId?: string;
  metadata?: QueueTelemetryMetadata;
}
