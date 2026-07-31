import { Module } from '@nestjs/common';
import type Redis from 'ioredis';

import { CACHE_STORE } from '@/common/constants';
import { InMemoryCacheAdapter } from './in-memory-cache.adapter';
import { RedisCacheAdapter } from './redis-cache.adapter';
import { REDIS_CLIENT } from './redis/redis.constants';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [RedisModule],
  providers: [
    RedisCacheAdapter,
    InMemoryCacheAdapter,
    {
      provide: CACHE_STORE,
      inject: [REDIS_CLIENT, RedisCacheAdapter, InMemoryCacheAdapter],
      useFactory: (
        redisClient: Redis | null,
        redisAdapter: RedisCacheAdapter,
        memoryAdapter: InMemoryCacheAdapter,
      ) => {
        return redisClient ? redisAdapter : memoryAdapter;
      },
    },
  ],
  exports: [CACHE_STORE, RedisModule],
})
export class CacheModule {}
