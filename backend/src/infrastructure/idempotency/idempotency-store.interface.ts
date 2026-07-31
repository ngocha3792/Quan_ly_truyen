export type IdempotencyState = 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface IdempotencyRecord {
  key: string;
  requestHash: string;
  state: IdempotencyState;
  statusCode?: number;
  responseBody?: unknown;
  headers?: Record<string, string>;
  createdAt: string;
  expiresAt: string;
}

export interface AcquireIdempotencyResult {
  acquired: boolean;
  existingRecord?: IdempotencyRecord;
}

export interface IdempotencyStore {
  acquire(
    key: string,
    requestHash: string,
    ttlSeconds: number,
  ): Promise<AcquireIdempotencyResult>;

  saveResult(
    key: string,
    result: {
      statusCode: number;
      responseBody: unknown;
      headers?: Record<string, string>;
    },
    ttlSeconds: number,
  ): Promise<void>;

  markFailed(key: string): Promise<void>;
}
