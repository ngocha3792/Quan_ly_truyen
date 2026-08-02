import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    HealthIndicatorResult,
    HealthIndicatorService,
} from '@nestjs/terminus';
import type Redis from 'ioredis';

import type { QueueConfig } from '@/config';
import { REDIS_CLIENT } from '@/infrastructure/cache/redis/redis.constants';
import { MetricsService } from '@/infrastructure/observability';

import { readQueueWorkerHeartbeat } from './queue-worker-heartbeat';

@Injectable()
export class QueueWorkerHealthIndicator {
    constructor(
        private readonly configService: ConfigService,
        @Inject(REDIS_CLIENT)
        private readonly redisClient: Redis | null,
        private readonly healthIndicator: HealthIndicatorService,
        private readonly metrics: MetricsService,
    ) { }

    async isHealthy(key = 'queue-worker'): Promise<HealthIndicatorResult> {
        const indicator = this.healthIndicator.check(key);
        const queueConfig = this.configService.getOrThrow<QueueConfig>('queue');

        const heartbeat = await readQueueWorkerHeartbeat(
            this.redisClient,
            queueConfig,
        );

        if (heartbeat.status === 'disabled') {
            this.metrics.setDependencyHealth('queue-worker', 'disabled');

            return indicator.up({
                disabled: true,
            });
        }

        if (heartbeat.status === 'up') {
            this.metrics.setDependencyHealth('queue-worker', 'up');

            return indicator.up({
                lastHeartbeatAt: heartbeat.lastHeartbeatAt,
                ageMs: heartbeat.ageMs,
            });
        }

        this.metrics.setDependencyHealth('queue-worker', 'down');

        return indicator.down({
            message: 'Queue worker heartbeat is missing or stale',
        });
    }
}