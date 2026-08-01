export const DISPATCH_OUTBOX_BATCH_JOB = 'outbox.dispatch-batch.v1';

export interface DispatchOutboxBatchJobV1 {
  version: 1;
  batchSize?: number;
  correlationId?: string;
}

export interface OutboxQueueEnvelope<TPayload> {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: TPayload;
  outboxEventId: string;
  createdAt: string;
  telemetry: QueueTelemetryMetadata;
}
import type { QueueTelemetryMetadata } from '@/common/interfaces/observability';
