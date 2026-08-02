import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';

import { sanitizeErrorForLog } from '@/common/utils';
import type { QueueConfig } from '@/config';
import { REDIS_CLIENT } from '@/infrastructure/cache/redis/redis.constants';

import { QUEUE_WORKER_HEARTBEAT_KEY } from './queue-worker-heartbeat';

@Injectable()
export class QueueWorkerHeartbeatService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(QueueWorkerHeartbeatService.name);

  private timer?: NodeJS.Timeout;
  private writeInProgress = false;

  constructor(
    private readonly configService: ConfigService,
    @Inject(REDIS_CLIENT)
    private readonly redisClient: Redis | null,
  ) {}

  async onModuleInit(): Promise<void> {
    const queueConfig = this.configService.getOrThrow<QueueConfig>('queue');

    if (!queueConfig.enabled || !queueConfig.workerHeartbeatEnabled) {
      this.logger.log('Queue worker heartbeat disabled');
      return;
    }

    if (!this.redisClient) {
      throw new Error(
        'Queue worker heartbeat requires an active Redis connection',
      );
    }

    // Lần ghi đầu tiên phải thành công, nếu không worker không nên khởi động.
    await this.writeHeartbeat(true);

    this.timer = setInterval(() => {
      void this.writeHeartbeat(false);
    }, queueConfig.workerHeartbeatIntervalMs);

    this.timer.unref();

    this.logger.log(
      `Queue worker heartbeat started (every ${queueConfig.workerHeartbeatIntervalMs}ms)`,
    );
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private async writeHeartbeat(throwOnFailure: boolean): Promise<void> {
    if (!this.redisClient || this.writeInProgress) return;

    this.writeInProgress = true;

    try {
      const queueConfig = this.configService.getOrThrow<QueueConfig>('queue');

      await this.redisClient.set(
        QUEUE_WORKER_HEARTBEAT_KEY,
        String(Date.now()),
        'EX',
        queueConfig.workerHeartbeatTtlSeconds,
      );
    } catch (error: unknown) {
      this.logger.error(
        'Failed to write queue worker heartbeat',
        sanitizeErrorForLog(error),
      );

      if (throwOnFailure) {
        throw error;
      }
    } finally {
      this.writeInProgress = false;
    }
  }
}
