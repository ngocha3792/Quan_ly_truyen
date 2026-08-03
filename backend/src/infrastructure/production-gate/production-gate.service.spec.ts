import { mkdtemp, mkdir, rm } from 'node:fs/promises';

import { tmpdir } from 'node:os';

import { join } from 'node:path';

import { AppEnvironment } from '@/common/enums';

import {
  EXPECTED_PRODUCTION_CONSTRAINTS,
  EXPECTED_PRODUCTION_INDEXES,
} from './production-database-contract';

import { ProductionGateService } from './production-gate.service';

describe('ProductionGateService', () => {
  let migrationRoot: string;

  let prisma: {
    $queryRaw: jest.Mock;

    $transaction: jest.Mock;

    role: {
      findMany: jest.Mock;
    };

    permission: {
      count: jest.Mock;
    };

    outboxEvent: {
      count: jest.Mock;
    };
  };

  let redis: {
    ping: jest.Mock;

    get: jest.Mock;
  };

  let mailHealth: {
    verify: jest.Mock;
  };

  beforeEach(async () => {
    migrationRoot = await mkdtemp(
      join(
        tmpdir(),

        'production-gate-',
      ),
    );

    await mkdir(
      join(
        migrationRoot,

        '20260801000000_initial',
      ),
    );

    prisma = {
      $queryRaw: jest.fn(),

      $transaction: jest.fn(),

      role: {
        findMany: jest.fn().mockResolvedValue([
          {
            code: 'USER',

            isSystem: true,

            _count: {
              permissions: 1,
            },
          },

          {
            code: 'AUTHOR',

            isSystem: true,

            _count: {
              permissions: 2,
            },
          },

          {
            code: 'ADMIN',

            isSystem: true,

            _count: {
              permissions: 3,
            },
          },
        ]),
      },

      permission: {
        count: jest.fn().mockResolvedValue(3),
      },

      outboxEvent: {
        count: jest.fn(),
      },
    };

    redis = {
      ping: jest.fn().mockResolvedValue('PONG'),

      get: jest.fn(),
    };

    mailHealth = {
      verify: jest.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(async () => {
    await rm(
      migrationRoot,

      {
        recursive: true,

        force: true,
      },
    );
  });

  it('passes predeploy when every production dependency is valid', async () => {
    prisma.$queryRaw
      /*
       * Database connection.
       */
      .mockResolvedValueOnce([
        {
          databaseName: 'quan_ly_truyen',

          serverTime: new Date(),
        },
      ])

      /*
       * Prisma migration history.
       */
      .mockResolvedValueOnce([
        {
          migrationName: '20260801000000_initial',

          finishedAt: new Date(),

          rolledBackAt: null,

          appliedStepsCount: 1,
        },
      ])

      /*
       * Indexes.
       */
      .mockResolvedValueOnce(
        EXPECTED_PRODUCTION_INDEXES.map((name) => ({
          name,
        })),
      )

      /*
       * Constraints.
       */
      .mockResolvedValueOnce(
        EXPECTED_PRODUCTION_CONSTRAINTS.map((name) => ({
          name,
        })),
      );

    const service = createService();

    const report = await service.inspect('predeploy');

    expect(report.ready).toBe(true);

    expect(report.checks.map(({ status }) => status)).not.toContain('failed');

    expect(mailHealth.verify).toHaveBeenCalledTimes(1);
  });

  it('fails when a local migration has not been deployed', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        {
          databaseName: 'quan_ly_truyen',

          serverTime: new Date(),
        },
      ])

      .mockResolvedValueOnce([]);

    const service = createService();

    const report = await service.inspect('predeploy');

    expect(report.ready).toBe(false);

    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'database-migrations',

          status: 'failed',

          message: expect.stringContaining('missing migrations'),
        }),
      ]),
    );
  });

  it('fails postdeploy when maintenance cleanup has not run', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        {
          databaseName: 'quan_ly_truyen',

          serverTime: new Date(),
        },
      ])

      .mockResolvedValueOnce([
        {
          migrationName: '20260801000000_initial',

          finishedAt: new Date(),

          rolledBackAt: null,

          appliedStepsCount: 1,
        },
      ])

      .mockResolvedValueOnce(
        EXPECTED_PRODUCTION_INDEXES.map((name) => ({
          name,
        })),
      )

      .mockResolvedValueOnce(
        EXPECTED_PRODUCTION_CONSTRAINTS.map((name) => ({
          name,
        })),
      );

    /*
     * Worker heartbeat.
     */
    redis.get
      .mockResolvedValueOnce(String(Date.now()))

      /*
       * Missing auth cleanup heartbeat.
       */
      .mockResolvedValueOnce(null);

    prisma.$transaction.mockResolvedValue([
      0,

      0,

      0,
    ]);

    const service = createService();

    const report = await service.inspect('postdeploy');

    expect(report.ready).toBe(false);

    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'maintenance-heartbeats',

          status: 'failed',
        }),
      ]),
    );
  });

  function createService(): ProductionGateService {
    const config = {
      getOrThrow: jest.fn((key: string) => {
        switch (key) {
          case 'app':
            return {
              environment: AppEnvironment.PRODUCTION,
            };

          case 'productionGate':
            return {
              migrationsPath: migrationRoot,

              cleanupMaxAgeHours: 30,
            };

          case 'redis':
            return {
              enabled: true,

              keyPrefix: 'qlt',
            };

          case 'queue':
            return {
              enabled: true,

              outboxProcessingTimeoutMs: 60_000,

              outboxFailedAlertThreshold: 5,

              workerHeartbeatEnabled: true,

              workerHeartbeatTtlSeconds: 30,
            };

          case 'mail':
            return {
              enabled: true,

              messageIdDomain: 'mail.example.com',

              smtp: {
                verifyOnStartup: true,
              },
            };

          default:
            throw new Error(`Unknown config key: ${key}`);
        }
      }),
    };

    return new ProductionGateService(
      config as never,

      prisma as never,

      redis as never,

      mailHealth as never,
    );
  }
});
