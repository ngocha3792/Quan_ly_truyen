import { readFileSync } from 'node:fs';

import { OutboxStatus } from '@/generated/prisma/client';

import { OutboxWriterService } from './outbox-writer.service';

describe('OutboxWriterService', () => {
  const propagation = {
    capture: jest.fn().mockReturnValue({
      schemaVersion: 1,
      source: 'api',
      correlationId: 'correlation-1',
    }),
  };
  const writer = new OutboxWriterService(propagation as never);

  it('creates a pending event through the supplied transaction client', async () => {
    const availableAt = new Date('2026-08-02T01:00:00Z');
    const tx = transactionClient();

    await expect(
      writer.create(tx as never, {
        aggregateType: 'mail',
        aggregateId: 'user-1',
        eventType: 'mail.send.v1',
        idempotencyKey: 'email-verification:token-1',
        payload: { version: 1, recipient: 'reader@example.test' },
        metadata: {
          schemaVersion: 1,
          source: 'api',
          correlationId: 'correlation-1',
        },
        availableAt,
      }),
    ).resolves.toEqual({ id: 'event-1' });

    expect(tx.outboxEvent.create).toHaveBeenCalledWith({
      data: {
        aggregateType: 'mail',
        aggregateId: 'user-1',
        eventType: 'mail.send.v1',
        idempotencyKey: 'email-verification:token-1',
        payload: { version: 1, recipient: 'reader@example.test' },
        metadata: {
          schemaVersion: 1,
          source: 'api',
          correlationId: 'correlation-1',
        },
        status: OutboxStatus.PENDING,
        availableAt,
      },
      select: { id: true },
    });
  });

  it('uses a current default availableAt and captures transport metadata', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-02T02:00:00Z'));
    try {
      const tx = transactionClient();
      await writer.create(tx as never, {
        aggregateType: 'mail',
        aggregateId: 'user-2',
        eventType: 'mail.send.v1',
        payload: {},
      });

      const calls = tx.outboxEvent.create.mock.calls as unknown as Array<
        [{ data: { availableAt: Date } }]
      >;
      expect(calls[0][0].data.availableAt).toEqual(
        new Date('2026-08-02T02:00:00Z'),
      );
      expect(propagation.capture).toHaveBeenCalledWith({
        source: 'api',
        causationId: undefined,
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('maps the business idempotency key to the unique outbox column', async () => {
    const tx = transactionClient();
    await writer.create(tx as never, {
      aggregateType: 'mail',
      aggregateId: 'user-3',
      eventType: 'mail.send.v1',
      idempotencyKey: 'email-verification:token-3',
      payload: {},
    });

    const [createArgs] = tx.outboxEvent.create.mock.calls[0] as unknown as [
      { data: { idempotencyKey?: string } },
    ];
    expect(createArgs.data.idempotencyKey).toBe('email-verification:token-3');
  });

  it('persists supplied W3C metadata without recapturing it', async () => {
    propagation.capture.mockClear();
    const tx = transactionClient();
    const metadata = {
      schemaVersion: 1 as const,
      source: 'api' as const,
      correlationId: 'correlation-2',
      causationId: 'request-2',
      traceContext: {
        traceparent: '00-11111111111111111111111111111111-2222222222222222-01',
      },
    };
    await writer.create(tx as never, {
      aggregateType: 'mail',
      aggregateId: 'user-4',
      eventType: 'mail.send.v1',
      payload: {},
      metadata,
    });

    expect(propagation.capture).not.toHaveBeenCalled();
    const createCalls: unknown = tx.outboxEvent.create.mock.calls;
    expect(JSON.stringify(createCalls)).toContain(
      metadata.traceContext.traceparent,
    );
    expect(JSON.stringify(createCalls)).toContain(metadata.correlationId);
  });

  it('has a deployable unique index migration for business retries', () => {
    const sql = readFileSync(
      'prisma/migrations/20260802052000_connect_registration_outbox/migration.sql',
      'utf8',
    );
    expect(sql).toContain('ADD COLUMN "idempotency_key" VARCHAR(200)');
    expect(sql).toContain('CREATE UNIQUE INDEX');
    expect(sql).toContain('"outbox_events"("idempotency_key")');
  });

  it('has a deployable JSONB migration for transport metadata', () => {
    const sql = readFileSync(
      'prisma/migrations/20260802090000_add_outbox_observability_metadata/migration.sql',
      'utf8',
    );
    expect(sql).toContain('ADD COLUMN "metadata" JSONB');
  });
});

function transactionClient() {
  return {
    outboxEvent: {
      create: jest.fn().mockResolvedValue({ id: 'event-1' }),
    },
  };
}
