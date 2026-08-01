import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';

import { DISTRIBUTED_LOCK } from '@/common/constants';
import { AppEnvironment } from '@/common/enums';
import type { AppConfig, InfrastructureFallbackConfig } from '@/config';
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
      inject: [
        REDIS_CLIENT,
        RedisDistributedLock,
        InMemoryDistributedLock,
        ConfigService,
      ],
      useFactory: (
        redisClient: Redis | null,
        redisLock: RedisDistributedLock,
        memoryLock: InMemoryDistributedLock,
        configService: ConfigService,
      ) => {
        if (redisClient) return redisLock;
        const app = configService.get<AppConfig>('app');
        const fallback = configService.get<InfrastructureFallbackConfig>(
          'infrastructureFallback',
        );
        return fallback?.allowInMemory &&
          app?.environment !== AppEnvironment.PRODUCTION
          ? memoryLock
          : redisLock;
      },
    },
  ],
  exports: [DISTRIBUTED_LOCK],
})
export class LockModule {}
