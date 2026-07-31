import { BullModule } from '@nestjs/bullmq';
import { DynamicModule, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { QueueConfig, RedisConfig } from '@/config';

import { QUEUE_NAMES } from './queue.constants';

const logger = new Logger('QueueModule');

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

            const redisUrl = new URL(redisConfig.url);

            logger.log(
              `Configuring BullMQ with Redis at ${redisUrl.hostname}:${redisUrl.port || '6379'}`,
            );

            return {
              prefix: queueConfig.prefix,
              connection: {
                host: redisUrl.hostname,
                port: Number(redisUrl.port) || 6379,
                password: redisUrl.password || undefined,
                username: redisUrl.username || undefined,
                db: redisUrl.pathname
                  ? Number(redisUrl.pathname.slice(1)) || 0
                  : 0,
                maxRetriesPerRequest: null,
              },
              defaultJobOptions: {
                attempts: queueConfig.defaultAttempts,
                backoff: {
                  type: 'exponential',
                  delay: queueConfig.defaultBackoffMs,
                },
                removeOnComplete: { count: 1000 },
                removeOnFail: { count: 5000 },
              },
            };
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
