import { Injectable } from '@nestjs/common';

import type { CacheStore } from './cache-store.interface';

interface MemoryCacheEntry {
  value: unknown;
  expiresAt?: number;
}

@Injectable()
export class InMemoryCacheAdapter implements CacheStore {
  private readonly store = new Map<string, MemoryCacheEntry>();

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
}
