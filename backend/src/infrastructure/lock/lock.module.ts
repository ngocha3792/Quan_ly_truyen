import { Module } from '@nestjs/common';
import type Redis from 'ioredis';

import { DISTRIBUTED_LOCK } from '@/common/constants';
import { REDIS_CLIENT } from '@/infrastructure/cache/redis/redis.constants';
import { RedisModule } from '@/infrastructure/cache/redis/redis.module';
import { InMemoryDistributedLock } from './in-memory-distributed-lock.adapter';
import { RedisDistributedLock } from './redis-distributed-lock.adapter';

@Module({
  imports: [RedisModule],
  providers: [
    RedisDistributedLock,
    InMemoryDistributedLock,
    {
      provide: DISTRIBUTED_LOCK,
      inject: [REDIS_CLIENT, RedisDistributedLock, InMemoryDistributedLock],
      useFactory: (
        redisClient: Redis | null,
        redisLock: RedisDistributedLock,
        memoryLock: InMemoryDistributedLock,
      ) => {
        return redisClient ? redisLock : memoryLock;
      },
    },
  ],
  exports: [DISTRIBUTED_LOCK],
})
export class LockModule {}
