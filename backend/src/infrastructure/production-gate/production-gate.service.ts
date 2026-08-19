import { Inject, Injectable } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { readdir } from 'node:fs/promises';

import { resolve } from 'node:path';

import type Redis from 'ioredis';

import { AppEnvironment } from '@/common/enums';

import type {
  AppConfig,
  MailConfig,
  ProductionGateConfig,
  QueueConfig,
  RedisConfig,
} from '@/config';

import { OutboxStatus } from '@/generated/prisma/enums';

import { REDIS_CLIENT } from '@/infrastructure/cache/redis/redis.constants';

import { PrismaService } from '@/infrastructure/database/prisma/prisma.service';

import { MailHealthService } from '@/infrastructure/mail/application/mail-health.service';

import { readQueueWorkerHeartbeat } from '@/infrastructure/health/queue-worker-heartbeat';

import {
  EXPECTED_PRODUCTION_CONSTRAINTS,
  EXPECTED_PRODUCTION_INDEXES,
  EXPECTED_PRODUCTION_ROLE_CODES,
} from './production-database-contract';

import {
  MAINTENANCE_HEARTBEAT_KEYS,
  MAINTENANCE_HEARTBEAT_VERSION,
  type MaintenanceHeartbeatKey,
  type MaintenanceHeartbeatV1,
} from './maintenance-heartbeat.constants';

export type ProductionGatePhase =
  'bootstrap-api' | 'bootstrap-worker' | 'predeploy' | 'postdeploy';

export type ProductionGateCheckStatus = 'passed' | 'failed' | 'skipped';

type GateFieldValue = string | number | boolean | null;

export interface ProductionGateCheckResult {
  name: string;

  status: ProductionGateCheckStatus;

  durationMs: number;

  message?: string;

  details?: Record<string, GateFieldValue>;
}

export interface ProductionGateReport {
  phase: ProductionGatePhase;

  ready: boolean;

  checkedAt: string;

  checks: readonly ProductionGateCheckResult[];
}

interface MigrationRow {
  migrationName: string;

  finishedAt: Date | null;

  rolledBackAt: Date | null;

  appliedStepsCount: number;
}

interface GateCheck {
  name: string;

  execute: () => Promise<Record<string, GateFieldValue>>;
}

@Injectable()
export class ProductionGateService {
  constructor(
    @Inject(ConfigService)
    private readonly configService: ConfigService,

    @Inject(PrismaService)
    private readonly prisma: PrismaService,

    @Inject(REDIS_CLIENT)
    private readonly redisClient: Redis | null,

    @Inject(MailHealthService)
    private readonly mailHealth: MailHealthService,
  ) {}

  async assertBootstrapReady(role: 'api' | 'worker'): Promise<void> {
    const app = this.configService.getOrThrow<AppConfig>('app');

    /*
     * Local/test không chạy production gate.
     */
    if (app.environment !== AppEnvironment.PRODUCTION) {
      return;
    }

    const report = await this.inspect(
      role === 'api' ? 'bootstrap-api' : 'bootstrap-worker',
    );

    if (!report.ready) {
      throw new ProductionGateException(report);
    }
  }

  async inspect(phase: ProductionGatePhase): Promise<ProductionGateReport> {
    const app = this.configService.getOrThrow<AppConfig>('app');

    if (app.environment !== AppEnvironment.PRODUCTION) {
      return {
        phase,

        ready: false,

        checkedAt: new Date().toISOString(),

        checks: [
          {
            name: 'production-environment',

            status: 'failed',

            durationMs: 0,

            message: 'NODE_ENV must be production',
          },
        ],
      };
    }

    const checks: GateCheck[] = [
      {
        name: 'database-connection',

        execute: () => this.checkDatabaseConnection(),
      },

      {
        name: 'database-migrations',

        execute: () => this.checkMigrations(),
      },

      {
        name: 'database-manual-objects',

        execute: () => this.checkManualDatabaseObjects(),
      },

      {
        name: 'database-seed-data',

        execute: () => this.checkSeedData(),
      },

      {
        name: 'redis',

        execute: () => this.checkRedis(),
      },
    ];

    const shouldVerifyMail =
      phase === 'predeploy' ||
      phase === 'postdeploy' ||
      phase === 'bootstrap-worker';

    if (shouldVerifyMail) {
      checks.push({
        name: 'smtp',

        execute: () => this.checkMail(),
      });
    }

    if (phase === 'postdeploy') {
      checks.push(
        {
          name: 'queue-worker-heartbeat',

          execute: () => this.checkWorkerHeartbeat(),
        },

        {
          name: 'outbox',

          execute: () => this.checkOutbox(),
        },

        {
          name: 'maintenance-heartbeats',

          execute: () => this.checkMaintenanceHeartbeats(),
        },
      );
    }

    const results: ProductionGateCheckResult[] = [];

    /*
     * Chạy tuần tự để lỗi dependency không tạo
     * hàng loạt connection/retry đồng thời.
     */
    for (const check of checks) {
      results.push(await this.runCheck(check));
    }

    return {
      phase,

      ready: results.every(({ status }) => status === 'passed'),

      checkedAt: new Date().toISOString(),

      checks: results,
    };
  }

  private async runCheck(check: GateCheck): Promise<ProductionGateCheckResult> {
    const startedAt = performance.now();

    try {
      const details = await check.execute();

      return {
        name: check.name,

        status: 'passed',

        durationMs: elapsedMs(startedAt),

        details,
      };
    } catch (error: unknown) {
      return {
        name: check.name,

        status: 'failed',

        durationMs: elapsedMs(startedAt),

        /*
         * Các check bên dưới chỉ throw message
         * cố định; không truyền URL/credential.
         */
        message:
          error instanceof Error
            ? error.message
            : 'Production gate check failed',
      };
    }
  }

  private async checkDatabaseConnection(): Promise<
    Record<string, GateFieldValue>
  > {
    try {
      const result = await this.prisma.$queryRaw<
        Array<{
          databaseName: string;

          serverTime: Date;
        }>
      >`
          SELECT
            current_database()
              AS "databaseName",

            NOW()
              AS "serverTime"
        `;

      const row = result[0];

      if (!row) {
        throw new Error('empty-result');
      }

      return {
        database: row.databaseName,

        serverTime: row.serverTime.toISOString(),
      };
    } catch {
      throw new Error('PostgreSQL connection check failed');
    }
  }

  private async checkMigrations(): Promise<Record<string, GateFieldValue>> {
    const config =
      this.configService.getOrThrow<ProductionGateConfig>('productionGate');

    const migrationsPath = resolve(
      process.cwd(),

      config.migrationsPath,
    );

    let localMigrations: string[];

    try {
      const entries = await readdir(
        migrationsPath,

        {
          withFileTypes: true,
        },
      );

      localMigrations = entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();
    } catch {
      throw new Error(
        'Prisma migrations directory is missing from the production artifact',
      );
    }

    if (localMigrations.length === 0) {
      throw new Error('No local Prisma migrations were found');
    }

    let databaseMigrations: MigrationRow[];

    try {
      databaseMigrations = await this.prisma.$queryRaw<MigrationRow[]>`
          SELECT
            migration_name
              AS "migrationName",

            finished_at
              AS "finishedAt",

            rolled_back_at
              AS "rolledBackAt",

            applied_steps_count
              AS "appliedStepsCount"

          FROM "_prisma_migrations"

          ORDER BY
            started_at ASC
        `;
    } catch {
      throw new Error('Prisma migration history is unavailable');
    }

    const incomplete = databaseMigrations.filter(
      (migration) =>
        migration.finishedAt === null && migration.rolledBackAt === null,
    );

    if (incomplete.length > 0) {
      throw new Error(
        `Database contains incomplete migrations: ${joinNames(
          incomplete.map(({ migrationName }) => migrationName),
        )}`,
      );
    }

    const applied = new Set(
      databaseMigrations
        .filter(
          (migration) =>
            migration.finishedAt !== null &&
            migration.rolledBackAt === null &&
            migration.appliedStepsCount > 0,
        )
        .map(({ migrationName }) => migrationName),
    );

    const local = new Set(localMigrations);

    const missingInDatabase = localMigrations.filter(
      (name) => !applied.has(name),
    );

    if (missingInDatabase.length > 0) {
      throw new Error(
        `Database is missing migrations: ${joinNames(missingInDatabase)}`,
      );
    }

    const unknownInArtifact = [...applied].filter((name) => !local.has(name));

    if (unknownInArtifact.length > 0) {
      throw new Error(
        `Production artifact is missing applied migrations: ${joinNames(
          unknownInArtifact,
        )}`,
      );
    }

    return {
      localMigrations: localMigrations.length,

      appliedMigrations: applied.size,

      migrationsPath: config.migrationsPath,
    };
  }

  private async checkManualDatabaseObjects(): Promise<
    Record<string, GateFieldValue>
  > {
    let indexes: Array<{
      name: string;
    }>;

    let constraints: Array<{
      name: string;
    }>;

    try {
      indexes = await this.prisma.$queryRaw`
          SELECT
            indexname AS name

          FROM pg_indexes

          WHERE
            schemaname =
              current_schema()
        `;

      constraints = await this.prisma.$queryRaw`
          SELECT
            conname AS name

          FROM pg_constraint

          WHERE
            connamespace = (
              SELECT oid
              FROM pg_namespace
              WHERE
                nspname =
                  current_schema()
            )
        `;
    } catch {
      throw new Error('Database object inspection failed');
    }

    const indexNames = new Set(indexes.map(({ name }) => name));

    const constraintNames = new Set(constraints.map(({ name }) => name));

    const missingIndexes = EXPECTED_PRODUCTION_INDEXES.filter(
      (name) => !indexNames.has(name),
    );

    const missingConstraints = EXPECTED_PRODUCTION_CONSTRAINTS.filter(
      (name) => !constraintNames.has(name),
    );

    if (missingIndexes.length > 0 || missingConstraints.length > 0) {
      throw new Error(
        [
          missingIndexes.length > 0
            ? `missing indexes: ${joinNames(missingIndexes)}`
            : '',

          missingConstraints.length > 0
            ? `missing constraints: ${joinNames(missingConstraints)}`
            : '',
        ]
          .filter(Boolean)
          .join('; '),
      );
    }

    return {
      expectedIndexes: EXPECTED_PRODUCTION_INDEXES.length,

      expectedConstraints: EXPECTED_PRODUCTION_CONSTRAINTS.length,
    };
  }

  private async checkSeedData(): Promise<Record<string, GateFieldValue>> {
    try {
      const [roles, permissionCount] = await Promise.all([
        this.prisma.role.findMany({
          where: {
            code: {
              in: [...EXPECTED_PRODUCTION_ROLE_CODES],
            },
          },

          select: {
            code: true,

            isSystem: true,

            _count: {
              select: {
                permissions: true,
              },
            },
          },
        }),

        this.prisma.permission.count(),
      ]);

      const roleMap = new Map(roles.map((role) => [role.code, role]));

      const missingRoles = EXPECTED_PRODUCTION_ROLE_CODES.filter(
        (code) => !roleMap.has(code),
      );

      const nonSystemRoles = roles.filter(({ isSystem }) => !isSystem);

      const admin = roleMap.get('ADMIN');

      if (
        permissionCount <= 0 ||
        missingRoles.length > 0 ||
        nonSystemRoles.length > 0 ||
        admin?._count.permissions !== permissionCount
      ) {
        throw new Error('Auth role and permission seed data is incomplete');
      }

      return {
        roleCount: roles.length,

        permissionCount,

        adminPermissionCount: admin._count.permissions,
      };
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.message === 'Auth role and permission seed data is incomplete'
      ) {
        throw error;
      }

      throw new Error('Seed data inspection failed', { cause: error });
    }
  }

  private async checkRedis(): Promise<Record<string, GateFieldValue>> {
    const config = this.configService.getOrThrow<RedisConfig>('redis');

    if (!config.enabled || !this.redisClient) {
      throw new Error('Redis is not available');
    }

    try {
      const result = await this.redisClient.ping();

      if (result !== 'PONG') {
        throw new Error('unexpected-result');
      }

      return {
        status: 'PONG',

        keyPrefix: config.keyPrefix,
      };
    } catch {
      throw new Error('Redis PING failed');
    }
  }

  private async checkMail(): Promise<Record<string, GateFieldValue>> {
    const config = this.configService.getOrThrow<MailConfig>('mail');

    if (!config.enabled) {
      throw new Error('Mail is disabled');
    }

    try {
      await this.mailHealth.verify();

      return {
        enabled: true,

        verifyOnStartup: config.smtp.verifyOnStartup,

        messageIdDomain: config.messageIdDomain,
      };
    } catch {
      throw new Error('SMTP verification failed');
    }
  }

  private async checkWorkerHeartbeat(): Promise<
    Record<string, GateFieldValue>
  > {
    const queue = this.configService.getOrThrow<QueueConfig>('queue');

    const heartbeat = await readQueueWorkerHeartbeat(
      this.redisClient,

      queue,
    );

    if (heartbeat.status !== 'up') {
      throw new Error('Queue worker heartbeat is missing or stale');
    }

    return {
      status: heartbeat.status,

      lastHeartbeatAt: heartbeat.lastHeartbeatAt ?? null,

      ageMs: heartbeat.ageMs ?? null,
    };
  }

  private async checkOutbox(): Promise<Record<string, GateFieldValue>> {
    const queue = this.configService.getOrThrow<QueueConfig>('queue');

    const now = Date.now();

    const staleBefore = new Date(now - queue.outboxProcessingTimeoutMs);

    const failedSince = new Date(now - 24 * 60 * 60_000);

    let pendingTooOld: number;

    let staleProcessing: number;

    let failedRecently: number;

    try {
      [pendingTooOld, staleProcessing, failedRecently] =
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
    } catch {
      throw new Error('Outbox inspection failed');
    }

    if (pendingTooOld > 0) {
      throw new Error(
        `Outbox contains ${pendingTooOld} overdue pending events`,
      );
    }

    if (staleProcessing > 0) {
      throw new Error(
        `Outbox contains ${staleProcessing} stale processing events`,
      );
    }

    if (failedRecently >= queue.outboxFailedAlertThreshold) {
      throw new Error(
        `Outbox failed-event threshold exceeded: ${failedRecently}`,
      );
    }

    return {
      pendingTooOld,

      staleProcessing,

      failedRecently,

      failedThreshold: queue.outboxFailedAlertThreshold,
    };
  }

  private async checkMaintenanceHeartbeats(): Promise<
    Record<string, GateFieldValue>
  > {
    if (!this.redisClient) {
      throw new Error('Redis is unavailable for maintenance heartbeat checks');
    }

    const config =
      this.configService.getOrThrow<ProductionGateConfig>('productionGate');

    const entries = [
      ['auth-cleanup', MAINTENANCE_HEARTBEAT_KEYS.AUTH_CLEANUP],

      ['outbox-cleanup', MAINTENANCE_HEARTBEAT_KEYS.OUTBOX_CLEANUP],

      ['mail-queue-cleanup', MAINTENANCE_HEARTBEAT_KEYS.MAIL_QUEUE_CLEANUP],
    ] as const;

    let oldestAgeHours = 0;

    for (const [command, key] of entries) {
      const heartbeat = await this.readMaintenanceHeartbeat(key);

      if (!heartbeat) {
        throw new Error(`Maintenance heartbeat is missing: ${command}`);
      }

      const completedAt = Date.parse(heartbeat.completedAt);

      if (!Number.isFinite(completedAt)) {
        throw new Error(`Maintenance heartbeat is malformed: ${command}`);
      }

      const ageHours =
        Math.max(
          0,

          Date.now() - completedAt,
        ) / 3_600_000;

      oldestAgeHours = Math.max(
        oldestAgeHours,

        ageHours,
      );

      if (ageHours > config.cleanupMaxAgeHours) {
        throw new Error(`Maintenance heartbeat is stale: ${command}`);
      }
    }

    return {
      requiredHeartbeats: entries.length,

      maxAllowedAgeHours: config.cleanupMaxAgeHours,

      oldestAgeHours: Number(oldestAgeHours.toFixed(2)),
    };
  }

  private async readMaintenanceHeartbeat(
    key: MaintenanceHeartbeatKey,
  ): Promise<MaintenanceHeartbeatV1 | null> {
    if (!this.redisClient) {
      return null;
    }

    let raw: string | null;

    try {
      raw = await this.redisClient.get(key);
    } catch {
      throw new Error('Unable to read maintenance heartbeat');
    }

    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<MaintenanceHeartbeatV1>;

      if (
        parsed.version !== MAINTENANCE_HEARTBEAT_VERSION ||
        typeof parsed.command !== 'string' ||
        typeof parsed.completedAt !== 'string'
      ) {
        return null;
      }

      return parsed as MaintenanceHeartbeatV1;
    } catch {
      return null;
    }
  }
}

export class ProductionGateException extends Error {
  constructor(readonly report: ProductionGateReport) {
    const failed = report.checks
      .filter(({ status }) => status === 'failed')
      .map(({ name }) => name);

    super(`Production gate failed: ${failed.join(', ')}`);

    this.name = ProductionGateException.name;
  }
}

function elapsedMs(startedAt: number): number {
  return Number((performance.now() - startedAt).toFixed(2));
}

function joinNames(values: readonly string[]): string {
  const maximum = 10;

  if (values.length <= maximum) {
    return values.join(', ');
  }

  return [
    ...values.slice(
      0,

      maximum,
    ),

    `+${values.length - maximum} more`,
  ].join(', ');
}
