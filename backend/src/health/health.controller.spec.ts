/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { HealthCheckService } from '@nestjs/terminus';
import { Test, TestingModule } from '@nestjs/testing';

import {
  DatabaseHealthIndicator,
  QueueWorkerHealthIndicator,
  RedisHealthIndicator,
} from '@/infrastructure/health';

import { HealthController } from './health.controller';
import { InfrastructureDiagnosticsService } from './infrastructure-diagnostics.service';

describe('HealthController', () => {
  let controller: HealthController;

  const mockHealthCheckService = {
    check: jest.fn().mockImplementation((checks) =>
      Promise.all(checks.map((fn: () => any) => fn())).then((results) => ({
        status: 'ok',
        info: Object.assign({}, ...results),
        error: {},
        details: Object.assign({}, ...results),
      })),
    ),
  };

  const mockDatabaseHealthIndicator = {
    isHealthy: jest.fn().mockResolvedValue({
      database: { status: 'up' },
    }),
  };
  const mockQueueWorkerHealthIndicator = {
    isHealthy: jest.fn().mockResolvedValue({
      'queue-worker': {
        status: 'up',
      },
    }),
  };


  const mockRedisHealthIndicator = {
    isHealthy: jest.fn().mockResolvedValue({
      redis: { status: 'up' },
    }),
  };

  const mockDiagnosticsService = {
    inspect: jest.fn().mockResolvedValue({
      database: { status: 'up' },
      redis: { status: 'disabled' },
      queue: { status: 'disabled' },
      mail: { status: 'disabled' },
      cloudinary: { status: 'disabled' },
      outbox: {
        status: 'up',
        pendingTooOld: 0,
        staleProcessing: 0,
        failedRecently: 0,
      },
      worker: {
        status: 'disabled',
      },
    }),

  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthCheckService,
          useValue: mockHealthCheckService,
        },
        {
          provide: QueueWorkerHealthIndicator,
          useValue: mockQueueWorkerHealthIndicator,
        },
        {
          provide: DatabaseHealthIndicator,
          useValue: mockDatabaseHealthIndicator,
        },
        {
          provide: RedisHealthIndicator,
          useValue: mockRedisHealthIndicator,
        },
        {
          provide: InfrastructureDiagnosticsService,
          useValue: mockDiagnosticsService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('live returns status ok', () => {
    expect(controller.live()).toEqual({ status: 'ok' });
  });

  it('ready performs health check on database and redis', async () => {
    const result = await controller.ready();
    expect(result.status).toBe('ok');
    expect(mockDatabaseHealthIndicator.isHealthy).toHaveBeenCalled();
    expect(mockRedisHealthIndicator.isHealthy).toHaveBeenCalled();
    expect(mockQueueWorkerHealthIndicator.isHealthy).toHaveBeenCalled();
  });

  it('returns sanitized infrastructure diagnostics', async () => {
    const result = await controller.diagnostics();
    expect(result.redis.status).toBe('disabled');
    expect(JSON.stringify(result)).not.toMatch(/password|secret|redis:\/\//i);
  });
});
