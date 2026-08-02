import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';

import type { MailConfig, QueueConfig, RedisConfig } from '@/config';
import { OutboxStatus } from '@/generated/prisma/enums';
import { REDIS_CLIENT } from '@/infrastructure/cache/redis/redis.constants';
import { PrismaService } from '@/infrastructure/database';
import { readQueueWorkerHeartbeat } from '@/infrastructure/health/queue-worker-heartbeat';
import { MailHealthService } from '@/infrastructure/mail';

type DiagnosticStatus = 'up' | 'down' | 'disabled' | 'configured';

export interface InfrastructureDiagnostics {
  database: {
    status: DiagnosticStatus;
  };

  redis: {
    status: DiagnosticStatus;
  };

  queue: {
    status: DiagnosticStatus;
  };

  worker: {
    status: DiagnosticStatus;
    lastHeartbeatAt?: string;
    ageMs?: number;
  };

  mail: {
    status: DiagnosticStatus;
  };

  cloudinary: {
    status: DiagnosticStatus;
  };

  outbox: {
    status: DiagnosticStatus;
    pendingTooOld: number;
    staleProcessing: number;
    failedRecently: number;
  };
}

@Injectable()
export class InfrastructureDiagnosticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Inject(REDIS_CLIENT)
    private readonly redisClient: Redis | null,
    private readonly mailHealth: MailHealthService,
  ) { }

  async inspect(): Promise<InfrastructureDiagnostics> {
    const queue = this.configService.getOrThrow<QueueConfig>('queue');
    const redis = this.configService.getOrThrow<RedisConfig>('redis');
    const mail = this.configService.getOrThrow<MailConfig>('mail');

    const cloudinaryEnabled = this.configService.get<boolean>(
      'cloudinary.enabled',
      false,
    );

    const databaseStatus = await this.databaseStatus();
    const redisStatus = await this.redisStatus(redis);
    const mailStatus = await this.mailStatus(mail);

    const worker = await readQueueWorkerHeartbeat(
      this.redisClient,
      queue,
    );

    const outbox = await this.outboxStatus(
      queue.outboxProcessingTimeoutMs,
      queue.outboxFailedAlertThreshold,
      databaseStatus,
    );

    return {
      database: {
        status: databaseStatus,
      },

      redis: {
        status: redisStatus,
      },

      queue: {
        status: queue.enabled
          ? redisStatus === 'up' && worker.status !== 'down'
            ? 'up'
            : 'down'
          : 'disabled',
      },

      worker,

      mail: {
        status: mailStatus,
      },

      cloudinary: {
        status: cloudinaryEnabled ? 'configured' : 'disabled',
      },

      outbox,
    };
  }

  private async databaseStatus(): Promise<'up' | 'down'> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'up';
    } catch {
      return 'down';
    }
  }

  private async redisStatus(
    config: RedisConfig,
  ): Promise<'up' | 'down' | 'disabled'> {
    if (!config.enabled) {
      return 'disabled';
    }

    if (!this.redisClient) {
      return 'down';
    }

    try {
      return (await this.redisClient.ping()) === 'PONG' ? 'up' : 'down';
    } catch {
      return 'down';
    }
  }

  private async mailStatus(
    config: MailConfig,
  ): Promise<'up' | 'down' | 'disabled'> {
    if (!config.enabled) {
      return 'disabled';
    }

    try {
      await this.mailHealth.verify();
      return 'up';
    } catch {
      return 'down';
    }
  }

  private async outboxStatus(
    processingTimeoutMs: number,
    failedAlertThreshold: number,
    databaseStatus: 'up' | 'down',
  ): Promise<InfrastructureDiagnostics['outbox']> {
    if (databaseStatus === 'down') {
      return {
        status: 'down',
        pendingTooOld: 0,
        staleProcessing: 0,
        failedRecently: 0,
      };
    }

    const now = Date.now();
    const staleBefore = new Date(now - processingTimeoutMs);
    const failedSince = new Date(now - 24 * 60 * 60_000);

    const [pendingTooOld, staleProcessing, failedRecently] =
      await this.prisma.$transaction([
        this.prisma.outboxEvent.count({
          where: {
            status: OutboxStatus.PENDING,
            availableAt: {
              lte: staleBefore,
            },
          },
        }),

        this.prisma.outboxEvent.count({
          where: {
            status: OutboxStatus.PROCESSING,
            processingStartedAt: {
              lte: staleBefore,
            },
          },
        }),

        this.prisma.outboxEvent.count({
          where: {
            status: OutboxStatus.FAILED,
            processedAt: {
              gte: failedSince,
            },
          },
        }),
      ]);

    const unhealthy =
      pendingTooOld > 0 ||
      staleProcessing > 0 ||
      failedRecently >= failedAlertThreshold;

    return {
      status: unhealthy ? 'down' : 'up',
      pendingTooOld,
      staleProcessing,
      failedRecently,
    };
  }
}