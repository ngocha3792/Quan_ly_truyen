import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { InfrastructureFallbackConfig } from '@/config';
import type { CacheStore } from './cache-store.interface';

interface MemoryCacheEntry {
  value: unknown;
  expiresAt?: number;
}

@Injectable()
export class InMemoryCacheAdapter implements CacheStore, OnModuleDestroy {
  private readonly store = new Map<string, MemoryCacheEntry>();
  private readonly maxEntries: number;
  private readonly sweepTimer: NodeJS.Timeout;

  constructor(configService: ConfigService) {
    const config = configService.get<InfrastructureFallbackConfig>(
      'infrastructureFallback',
    );
    this.maxEntries = config?.inMemoryStoreMaxEntries ?? 10_000;
    this.sweepTimer = setInterval(
      () => this.sweepExpired(),
      config?.inMemoryStoreSweepIntervalMs ?? 60_000,
    );
    this.sweepTimer.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.sweepTimer);
  }

  async get<T>(key: string): Promise<T | null> {
    await Promise.resolve();
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    await Promise.resolve();
    if (!this.store.has(key)) {
      this.evictIfFull();
    }
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
    this.store.set(key, { value, expiresAt });
  }

  async delete(key: string): Promise<void> {
    await Promise.resolve();
    this.store.delete(key);
  }

  async deleteMany(keys: readonly string[]): Promise<void> {
    await Promise.resolve();
    for (const key of keys) {
      this.store.delete(key);
    }
  }

  private sweepExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (entry.expiresAt !== undefined && entry.expiresAt <= now) {
        this.store.delete(key);
      }
    }
  }

  private evictIfFull(): void {
    this.sweepExpired();
    while (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value as string | undefined;
      if (!oldestKey) break;
      this.store.delete(oldestKey);
    }
  }
}
