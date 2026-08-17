import { randomUUID } from 'node:crypto';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { AppConfigModule } from '@/config';
import { PrismaModule, PrismaService } from '@/infrastructure/database';
import {
  AUDIT_LOG_METRICS_PORT,
  AUDIT_LOG_REPOSITORY_PORT,
  AuditLogsService,
} from '@/modules/audit-logs/application';
import { PrismaAuditLogRepository } from '@/modules/audit-logs/infrastructure';

const runId = randomUUID().replaceAll('-', '').slice(0, 12);
let sequence = 0;
const unique = (prefix: string) => `${prefix}-${runId}-${++sequence}`;

describe('Audit log PostgreSQL read-side', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let auditLogs: AuditLogsService;
  let actorId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppConfigModule, PrismaModule],
      providers: [
        PrismaAuditLogRepository,
        AuditLogsService,
        {
          provide: AUDIT_LOG_REPOSITORY_PORT,
          useExisting: PrismaAuditLogRepository,
        },
        {
          provide: AUDIT_LOG_METRICS_PORT,
          useValue: { recordRead: jest.fn() },
        },
      ],
    }).compile();
    await moduleRef.init();
    prisma = moduleRef.get(PrismaService);
    auditLogs = moduleRef.get(AuditLogsService);
  });

  beforeEach(async () => {
    const marker = unique('actor').toLowerCase();
    actorId = (
      await prisma.user.create({
        data: {
          email: `${marker}@example.test`,
          username: marker.slice(0, 48),
          displayName: 'Audit Test Actor',
        },
      })
    ).id;
  });

  afterEach(async () => cleanup());
  afterAll(async () => {
    await cleanup();
    await moduleRef.close();
  });

  it('returns a lightweight newest-first list with exact filters', async () => {
    const requestId = unique('request');
    const entityId = unique('entity');
    const first = await prisma.auditLog.create({
      data: {
        actorId,
        action: 'audit.test.first',
        entityType: 'user',
        entityId,
        requestId,
        oldValues: { status: 'ACTIVE', passwordHash: 'LIST_MUST_NOT_LOAD_ME' },
        metadata: { note: 'private payload' },
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await prisma.auditLog.create({
      data: {
        actorId,
        action: 'audit.test.second',
        entityType: 'user',
        entityId,
        requestId,
        newValues: { status: 'SUSPENDED' },
        ipAddress: '203.0.113.42',
        userAgent: 'integration-agent',
      },
    });

    const result = await auditLogs.list({
      actorId,
      entityType: 'user',
      entityId,
      requestId,
      from: new Date(first.createdAt.getTime() - 1_000),
      to: new Date(second.createdAt.getTime() + 1_000),
      page: 1,
      pageSize: 20,
    });

    expect(result.items.map((item) => item.id)).toEqual([second.id, first.id]);
    expect(result.pagination.totalItems).toBe(2);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('oldValues');
    expect(serialized).not.toContain('newValues');
    expect(serialized).not.toContain('metadata');
    expect(serialized).not.toContain('ipAddress');
    expect(serialized).not.toContain('LIST_MUST_NOT_LOAD_ME');
  });

  it('redacts intentionally unsafe historical JSON before any detail response', async () => {
    const row = await prisma.auditLog.create({
      data: {
        actorId,
        action: 'audit.security.regression',
        entityType: 'user',
        entityId: actorId,
        requestId: unique('unsafe-request'),
        oldValues: { passwordHash: 'DO_NOT_LEAK_1' },
        newValues: {
          nested: { refreshToken: 'DO_NOT_LEAK_2' },
          status: 'ACTIVE',
        },
        metadata: {
          sessions: [{ mfa_secret: 'DO_NOT_LEAK_3' }],
          header: 'Bearer DO_NOT_LEAK_4',
        },
        ipAddress: '203.0.113.42',
        userAgent: 'u'.repeat(2_000),
      },
    });

    const detail = await auditLogs.detail(row.id);
    const serialized = JSON.stringify(detail);
    for (const secret of [
      'DO_NOT_LEAK_1',
      'DO_NOT_LEAK_2',
      'DO_NOT_LEAK_3',
      'DO_NOT_LEAK_4',
    ]) {
      expect(serialized).not.toContain(secret);
    }
    expect(serialized).toContain('[REDACTED]');
    expect(detail.client.ipAddress).toBe('203.0.113.xxx');
    expect(detail.client.userAgent?.length).toBeLessThan(600);
    expect(detail.changes.some((change) => change.path === 'status')).toBe(
      true,
    );
  });

  it('keeps unknown actions/entity types readable and survives actor deletion', async () => {
    const row = await prisma.auditLog.create({
      data: {
        actorId,
        action: 'future.some.action',
        entityType: 'future_entity',
        entityId: unique('future'),
      },
    });
    await prisma.user.delete({ where: { id: actorId } });
    const detail = await auditLogs.detail(row.id);
    expect(detail.action).toBe('future.some.action');
    expect(detail.entity.type).toBe('future_entity');
    expect(detail.actor).toBeNull();
  });

  it('rejects reversed date ranges', async () => {
    await expect(
      auditLogs.list({
        from: new Date('2026-08-16T12:00:00Z'),
        to: new Date('2026-08-15T12:00:00Z'),
        page: 1,
        pageSize: 20,
      }),
    ).rejects.toMatchObject({ code: 'AUDIT_INVALID_DATE_RANGE' });
  });

  async function cleanup(): Promise<void> {
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { requestId: { contains: runId } },
          { action: { startsWith: 'audit.test.' } },
          { action: 'audit.security.regression' },
          { action: 'future.some.action' },
        ],
      },
    });
    await prisma.user.deleteMany({ where: { email: { contains: runId } } });
  }
});
