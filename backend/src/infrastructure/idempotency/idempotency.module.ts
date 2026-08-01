import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';

import { IDEMPOTENCY_STORE } from '@/common/constants';
import { AppEnvironment } from '@/common/enums';
import type { AppConfig, InfrastructureFallbackConfig } from '@/config';
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
      inject: [
        REDIS_CLIENT,
        RedisIdempotencyStore,
        InMemoryIdempotencyStore,
        ConfigService,
      ],
      useFactory: (
        redisClient: Redis | null,
        redisStore: RedisIdempotencyStore,
        memoryStore: InMemoryIdempotencyStore,
        configService: ConfigService,
      ) => {
        if (redisClient) return redisStore;
        const app = configService.get<AppConfig>('app');
        const fallback = configService.get<InfrastructureFallbackConfig>(
          'infrastructureFallback',
        );
        return fallback?.allowInMemory &&
          app?.environment !== AppEnvironment.PRODUCTION
          ? memoryStore
          : redisStore;
      },
    },
  ],
  exports: [IDEMPOTENCY_STORE],
})
export class IdempotencyModule {}
