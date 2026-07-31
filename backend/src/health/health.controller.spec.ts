import { HealthCheckService } from '@nestjs/terminus';
import { Test, TestingModule } from '@nestjs/testing';

import {
  DatabaseHealthIndicator,
  RedisHealthIndicator,
} from '@/infrastructure/health';

import { HealthController } from './health.controller';

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

  const mockRedisHealthIndicator = {
    isHealthy: jest.fn().mockResolvedValue({
      redis: { status: 'up' },
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
          provide: DatabaseHealthIndicator,
          useValue: mockDatabaseHealthIndicator,
        },
        {
          provide: RedisHealthIndicator,
          useValue: mockRedisHealthIndicator,
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
  });
});
