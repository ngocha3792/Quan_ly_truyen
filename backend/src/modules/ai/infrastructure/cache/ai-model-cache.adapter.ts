import { Inject, Injectable } from '@nestjs/common';

import { CACHE_STORE } from '@/common/constants';
import type { CacheStore } from '@/infrastructure/cache';

import type { AiModelCachePort, AiModelInfo } from '../../application/ports';

function modelCacheKey(connectionId: string): string {
  return `ai:models:${connectionId}`;
}

@Injectable()
export class AiModelCacheAdapter implements AiModelCachePort {
  constructor(@Inject(CACHE_STORE) private readonly cache: CacheStore) {}

  get(connectionId: string): Promise<readonly AiModelInfo[] | null> {
    return this.cache.get<readonly AiModelInfo[]>(modelCacheKey(connectionId));
  }

  set(
    connectionId: string,
    models: readonly AiModelInfo[],
    ttlSeconds: number,
  ): Promise<void> {
    return this.cache.set(modelCacheKey(connectionId), models, ttlSeconds);
  }

  delete(connectionId: string): Promise<void> {
    return this.cache.delete(modelCacheKey(connectionId));
  }
}
