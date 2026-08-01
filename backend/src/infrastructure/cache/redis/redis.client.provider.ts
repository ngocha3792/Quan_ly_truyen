import { Logger, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import type { RedisConfig } from '@/config';

import { REDIS_CLIENT } from './redis.constants';
import { createRedisConnectionOptions } from './redis-connection-options.factory';

export const redisClientProvider: Provider = {
  provide: REDIS_CLIENT,
  inject: [ConfigService],
  useFactory: (configService: ConfigService): Redis | null => {
    const redisConfig = configService.get<RedisConfig>('redis');
    const logger = new Logger('RedisClientProvider');

    if (!redisConfig?.enabled) {
      logger.log('Redis is disabled by configuration (REDIS_ENABLED=false)');
      return null;
    }

    try {
      const options = createRedisConnectionOptions(redisConfig.url, {
        keyPrefix: `${redisConfig.keyPrefix}:`,
        connectTimeout: redisConfig.connectTimeoutMs,
        commandTimeout: redisConfig.commandTimeoutMs,
        lazyConnect: false,
        maxRetriesPerRequest: 3,
        retryStrategy(times: number) {
          const delay = Math.min(times * 100, 3000);
          return delay;
        },
      });
      const client = new Redis(options);

      client.on('connect', () => {
        logger.log('Redis client connected successfully');
      });

      client.on('error', (err: Error) => {
        logger.warn(`Redis client error: ${err.message}`);
      });

      return client;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown Redis init error';
      logger.error(`Failed to initialize Redis client: ${message}`);
      return null;
    }
  },
};
