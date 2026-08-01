export type IdempotencyState = 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface IdempotencyRecord {
  key: string;
  requestHash: string;
  state: IdempotencyState;
  ownerToken: string;
  statusCode?: number;
  responseBody?: unknown;
  headers?: Record<string, string>;
  createdAt: string;
  expiresAt: string;
}

export interface AcquiredIdempotencyLease {
  acquired: true;
  ownerToken: string;
}

export interface ExistingIdempotencyLease {
  acquired: false;
  existingRecord?: IdempotencyRecord;
}

export type AcquireIdempotencyResult =
  AcquiredIdempotencyLease | ExistingIdempotencyLease;

export interface IdempotencyResult {
  statusCode: number;
  responseBody: unknown;
  headers?: Record<string, string>;
}

export interface IdempotencyStore {
  acquire(
    key: string,
    requestHash: string,
    ttlSeconds: number,
  ): Promise<AcquireIdempotencyResult>;

  saveResult(
    key: string,
    ownerToken: string,
    result: IdempotencyResult,
    ttlSeconds: number,
  ): Promise<void>;

  markFailed(key: string, ownerToken: string): Promise<void>;
}
