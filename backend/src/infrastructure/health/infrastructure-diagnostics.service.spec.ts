import { ConfigService } from '@nestjs/config';

import { InfrastructureDiagnosticsService } from './infrastructure-diagnostics.service';

describe('InfrastructureDiagnosticsService', () => {
  const prisma = {
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
    outboxEvent: { count: jest.fn() },
  };
  const redis = { ping: jest.fn() };
  const mailHealth = { verify: jest.fn() };

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    prisma.$transaction.mockResolvedValue([0, 0, 0]);
    mailHealth.verify.mockResolvedValue(undefined);
  });

  function service(
    enabled: {
      redis: boolean;
      queue: boolean;
      mail: boolean;
      cloudinary: boolean;
    },
    redisClient: typeof redis | null = redis,
  ): InfrastructureDiagnosticsService {
    return new InfrastructureDiagnosticsService(
      prisma as never,
      new ConfigService({
        redis: { enabled: enabled.redis },
        queue: {
          enabled: enabled.queue,
          outboxProcessingTimeoutMs: 60_000,
          outboxFailedAlertThreshold: 5,
          workerHeartbeatEnabled: false,
          workerHeartbeatIntervalMs: 10_000,
          workerHeartbeatTtlSeconds: 30,
        },
        mail: { enabled: enabled.mail },
        cloudinary: { enabled: enabled.cloudinary },
      }),
      redisClient as never,
      mailHealth as never,
    );
  }

  it('reports disabled dependencies as disabled rather than down', async () => {
    const result = await service({
      redis: false,
      queue: false,
      mail: false,
      cloudinary: false,
    }).inspect();
    expect(result).toEqual(
      expect.objectContaining({
        redis: { status: 'disabled' },
        queue: { status: 'disabled' },
        mail: { status: 'disabled' },
        cloudinary: { status: 'disabled' },
      }),
    );
  });

  it('maps enabled Redis success and failure without exposing errors', async () => {
    redis.ping.mockResolvedValueOnce('PONG');
    await expect(
      service({
        redis: true,
        queue: true,
        mail: true,
        cloudinary: true,
      }).inspect(),
    ).resolves.toEqual(
      expect.objectContaining({
        redis: { status: 'up' },
        queue: { status: 'up' },
        mail: { status: 'up' },
        cloudinary: { status: 'configured' },
      }),
    );
    redis.ping.mockRejectedValueOnce(
      new Error('redis://user:secret@example.com'),
    );
    const failed = await service({
      redis: true,
      queue: true,
      mail: true,
      cloudinary: true,
    }).inspect();
    expect(failed.redis.status).toBe('down');
    expect(JSON.stringify(failed)).not.toContain('secret');
  });

  it('maps enabled SMTP verification failures to down', async () => {
    redis.ping.mockResolvedValue('PONG');
    mailHealth.verify.mockRejectedValue(new Error('smtp secret'));
    const result = await service({
      redis: true,
      queue: true,
      mail: true,
      cloudinary: false,
    }).inspect();
    expect(result.mail.status).toBe('down');
    expect(JSON.stringify(result)).not.toContain('smtp secret');
  });
});
