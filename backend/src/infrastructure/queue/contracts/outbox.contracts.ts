export const DISPATCH_OUTBOX_BATCH_JOB = 'outbox.dispatch-batch.v1';

export interface DispatchOutboxBatchJobV1 {
  version: 1;
  batchSize?: number;
  correlationId?: string;
}
