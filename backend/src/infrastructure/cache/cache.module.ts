import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';

import { CACHE_STORE } from '@/common/constants';
import { AppEnvironment } from '@/common/enums';
import type { AppConfig, InfrastructureFallbackConfig } from '@/config';
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
      inject: [
        REDIS_CLIENT,
        RedisCacheAdapter,
        InMemoryCacheAdapter,
        ConfigService,
      ],
      useFactory: (
        redisClient: Redis | null,
        redisAdapter: RedisCacheAdapter,
        memoryAdapter: InMemoryCacheAdapter,
        configService: ConfigService,
      ) => {
        if (redisClient) return redisAdapter;
        const app = configService.get<AppConfig>('app');
        const fallback = configService.get<InfrastructureFallbackConfig>(
          'infrastructureFallback',
        );
        return fallback?.allowInMemory &&
          app?.environment !== AppEnvironment.PRODUCTION
          ? memoryAdapter
          : redisAdapter;
      },
    },
  ],
  exports: [CACHE_STORE, RedisModule],
})
export class CacheModule {}
