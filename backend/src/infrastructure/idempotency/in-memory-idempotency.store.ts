import { randomUUID } from 'node:crypto';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  ConcurrencyConflictException,
  ServiceUnavailableException,
} from '@/common/exceptions';
import type { IdempotencyConfig, InfrastructureFallbackConfig } from '@/config';

import type {
  AcquireIdempotencyResult,
  IdempotencyRecord,
  IdempotencyResult,
  IdempotencyStore,
} from './idempotency-store.interface';

@Injectable()
export class InMemoryIdempotencyStore
  implements IdempotencyStore, OnModuleDestroy
{
  private readonly records = new Map<string, IdempotencyRecord>();
  private readonly maxEntries: number;
  private readonly maxResponseBytes: number;
  private readonly sweepTimer: NodeJS.Timeout;

  constructor(configService: ConfigService) {
    const fallback = configService.get<InfrastructureFallbackConfig>(
      'infrastructureFallback',
    );
    const idempotency = configService.get<IdempotencyConfig>('idempotency');
    this.maxEntries = fallback?.inMemoryStoreMaxEntries ?? 10_000;
    this.maxResponseBytes = idempotency?.maxResponseBytes ?? 1_048_576;
    this.sweepTimer = setInterval(
      () => this.sweepExpired(),
      fallback?.inMemoryStoreSweepIntervalMs ?? 60_000,
    );
    this.sweepTimer.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.sweepTimer);
  }

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

    this.evictIfFull();
    const ownerToken = randomUUID();
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

    const record: IdempotencyRecord = {
      key,
      requestHash,
      state: 'PROCESSING',
      ownerToken,
      createdAt: now,
      expiresAt,
    };

    this.records.set(key, record);
    return { acquired: true, ownerToken };
  }

  async saveResult(
    key: string,
    ownerToken: string,
    result: IdempotencyResult,
    ttlSeconds: number,
  ): Promise<void> {
    await Promise.resolve();
    const existing = this.records.get(key);
    if (
      !existing ||
      existing.state !== 'PROCESSING' ||
      existing.ownerToken !== ownerToken
    ) {
      throw new ConcurrencyConflictException({
        resource: key,
        message: 'Idempotency processing lease is no longer owned',
      });
    }
    this.assertResponseSize(result);

    const record: IdempotencyRecord = {
      key,
      requestHash: existing.requestHash,
      state: 'COMPLETED',
      ownerToken,
      statusCode: result.statusCode,
      responseBody: result.responseBody,
      headers: result.headers,
      createdAt: existing.createdAt,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
    };

    this.records.set(key, record);
  }

  async markFailed(key: string, ownerToken: string): Promise<void> {
    await Promise.resolve();
    const existing = this.records.get(key);
    if (
      existing?.state === 'PROCESSING' &&
      existing.ownerToken === ownerToken
    ) {
      this.records.delete(key);
    }
  }

  private sweepExpired(): void {
    const now = Date.now();
    for (const [key, record] of this.records) {
      if (new Date(record.expiresAt).getTime() <= now) {
        this.records.delete(key);
      }
    }
  }

  private evictIfFull(): void {
    this.sweepExpired();
    while (this.records.size >= this.maxEntries) {
      const oldestKey = this.records.keys().next().value as string | undefined;
      if (!oldestKey) break;
      this.records.delete(oldestKey);
    }
  }

  private assertResponseSize(result: IdempotencyResult): void {
    const bytes = Buffer.byteLength(JSON.stringify(result), 'utf8');
    if (bytes > this.maxResponseBytes) {
      throw new ServiceUnavailableException({
        code: 'IDEMPOTENCY_RESPONSE_TOO_LARGE',
        service: 'idempotency',
        message: 'Idempotent response exceeds the configured storage limit',
        details: { maxResponseBytes: this.maxResponseBytes },
      });
    }
  }
}
