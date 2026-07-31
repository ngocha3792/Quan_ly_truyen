import { Module } from '@nestjs/common';
import type Redis from 'ioredis';

import { IDEMPOTENCY_STORE } from '@/common/constants';
import { REDIS_CLIENT } from '@/infrastructure/cache/redis/redis.constants';
import { RedisModule } from '@/infrastructure/cache/redis/redis.module';
import { InMemoryIdempotencyStore } from './in-memory-idempotency.store';
import { RedisIdempotencyStore } from './redis-idempotency.store';

@Module({
  imports: [RedisModule],
  providers: [
    RedisIdempotencyStore,
    InMemoryIdempotencyStore,
    {
      provide: IDEMPOTENCY_STORE,
      inject: [REDIS_CLIENT, RedisIdempotencyStore, InMemoryIdempotencyStore],
      useFactory: (
        redisClient: Redis | null,
        redisStore: RedisIdempotencyStore,
        memoryStore: InMemoryIdempotencyStore,
      ) => {
        return redisClient ? redisStore : memoryStore;
      },
    },
  ],
  exports: [IDEMPOTENCY_STORE],
})
export class IdempotencyModule {}
