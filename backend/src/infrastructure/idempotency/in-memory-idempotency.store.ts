import { Injectable } from '@nestjs/common';

import type {
  AcquireIdempotencyResult,
  IdempotencyRecord,
  IdempotencyStore,
} from './idempotency-store.interface';

@Injectable()
export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly records = new Map<string, IdempotencyRecord>();

  async acquire(
    key: string,
    requestHash: string,
    ttlSeconds: number,
  ): Promise<AcquireIdempotencyResult> {
    await Promise.resolve();
    const existing = this.records.get(key);

    if (existing) {
      if (new Date(existing.expiresAt).getTime() < Date.now()) {
        this.records.delete(key);
      } else {
        return {
          acquired: false,
          existingRecord: existing,
        };
      }
    }

    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

    const record: IdempotencyRecord = {
      key,
      requestHash,
      state: 'PROCESSING',
      createdAt: now,
      expiresAt,
    };

    this.records.set(key, record);
    return { acquired: true };
  }

  async saveResult(
    key: string,
    result: {
      statusCode: number;
      responseBody: unknown;
      headers?: Record<string, string>;
    },
    ttlSeconds: number,
  ): Promise<void> {
    await Promise.resolve();
    const existing = this.records.get(key);
    const createdAt = existing ? existing.createdAt : new Date().toISOString();
    const requestHash = existing ? existing.requestHash : '';

    const record: IdempotencyRecord = {
      key,
      requestHash,
      state: 'COMPLETED',
      statusCode: result.statusCode,
      responseBody: result.responseBody,
      headers: result.headers,
      createdAt,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
    };

    this.records.set(key, record);
  }

  async markFailed(key: string): Promise<void> {
    await Promise.resolve();
    this.records.delete(key);
  }
}
