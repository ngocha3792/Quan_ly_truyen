import { BullModule } from '@nestjs/bullmq';
import { DynamicModule, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { ObservabilityConfig, QueueConfig, RedisConfig } from '@/config';
import { createRedisConnectionOptions } from '@/infrastructure/cache/redis';

import { QUEUE_NAMES } from './queue.constants';
import { getBullMqTelemetry, QueueMetricsObserver } from './observability';

const logger = new Logger('QueueModule');

export function isQueueEnvironmentEnabled(
  environment: NodeJS.ProcessEnv,
): boolean {
  return (
    environment.QUEUE_ENABLED === 'true' && environment.REDIS_ENABLED === 'true'
  );
}

export function createBullQueueOptions(
  queueConfig: QueueConfig,
  redisConfig: RedisConfig,
  observabilityConfig?: ObservabilityConfig,
) {
  return {
    prefix: queueConfig.prefix,
    connection: createRedisConnectionOptions(redisConfig.url, {
      connectTimeout: redisConfig.connectTimeoutMs,
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
    ...(observabilityConfig
      ? { telemetry: getBullMqTelemetry(observabilityConfig) }
      : {}),
  };
}

@Module({})
export class QueueModule {
  static register(): DynamicModule {
    const enabled = isQueueEnvironmentEnabled(process.env);

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
            const observabilityConfig =
              configService.getOrThrow<ObservabilityConfig>('observability');

            logger.log('Configuring BullMQ Redis connection');
            return createBullQueueOptions(
              queueConfig,
              redisConfig,
              observabilityConfig,
            );
          },
        }),
        ...Object.values(QUEUE_NAMES).map((name) =>
          BullModule.registerQueue({ name }),
        ),
      ],
      exports: [BullModule],
      providers: [QueueMetricsObserver],
    };
  }
}
