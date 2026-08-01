import { BullModule } from '@nestjs/bullmq';
import { DynamicModule, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { QueueConfig, RedisConfig } from '@/config';
import { createRedisConnectionOptions } from '@/infrastructure/cache/redis';

import { QUEUE_NAMES } from './queue.constants';

const logger = new Logger('QueueModule');

export function createBullQueueOptions(
  queueConfig: QueueConfig,
  redisConfig: RedisConfig,
) {
  return {
    prefix: queueConfig.prefix,
    connection: createRedisConnectionOptions(redisConfig.url, {
      maxRetriesPerRequest: null,
    }),
    defaultJobOptions: {
      attempts: queueConfig.defaultAttempts,
      backoff: {
        type: 'exponential' as const,
        delay: queueConfig.defaultBackoffMs,
      },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    },
  };
}

@Module({})
export class QueueModule {
  static register(): DynamicModule {
    const enabled =
      process.env.QUEUE_ENABLED === 'true' &&
      process.env.REDIS_ENABLED === 'true';

    if (!enabled) {
      logger.log(
        'Queue system disabled (QUEUE_ENABLED=false or REDIS_ENABLED=false)',
      );
      return {
        module: QueueModule,
        global: true,
      };
    }

    return {
      module: QueueModule,
      global: true,
      imports: [
        BullModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (configService: ConfigService) => {
            const queueConfig = configService.getOrThrow<QueueConfig>('queue');
            const redisConfig = configService.getOrThrow<RedisConfig>('redis');

            logger.log('Configuring BullMQ Redis connection');
            return createBullQueueOptions(queueConfig, redisConfig);
          },
        }),
        ...Object.values(QUEUE_NAMES).map((name) =>
          BullModule.registerQueue({ name }),
        ),
      ],
      exports: [BullModule],
    };
  }
}
