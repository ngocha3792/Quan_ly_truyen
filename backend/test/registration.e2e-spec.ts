import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '@/app.module';
import { IDEMPOTENCY_STORE } from '@/common/constants';
import { configureApplication } from '@/bootstrap/application-configurator';
import type { AppConfig } from '@/config';
import { PrismaService } from '@/infrastructure/database/prisma';
import type {
  AcquireIdempotencyResult,
  IdempotencyResult,
  IdempotencyStore,
} from '@/infrastructure/idempotency';
import { InMemoryIdempotencyStore } from '@/infrastructure/idempotency';
import type { Prisma } from '@/generated/prisma/client';
import { OutboxWriterService } from '@/infrastructure/queue/outbox/outbox-writer.service';
import type { CreateOutboxEventInput } from '@/infrastructure/queue/outbox/outbox.types';

class ControlledOutboxWriter {
  fail = false;
  private readonly delegate = new OutboxWriterService({
    capture: () => ({ schemaVersion: 1, source: 'system' }),
  } as never);

  create(
    tx: Prisma.TransactionClient,
    input: CreateOutboxEventInput,
  ): Promise<{ id: string }> {
    if (this.fail) {
      return Promise.reject(new Error('controlled outbox failure'));
    }
    return this.delegate.create(tx, input);
  }
}

class ControlledIdempotencyStore implements IdempotencyStore {
  failNextSave = false;
  markFailedCalls = 0;

  constructor(private readonly delegate: InMemoryIdempotencyStore) {}

  acquire(
    key: string,
    requestHash: string,
    ttlSeconds: number,
  ): Promise<AcquireIdempotencyResult> {
    return this.delegate.acquire(key, requestHash, ttlSeconds);
  }

  saveResult(
    key: string,
    ownerToken: string,
    result: IdempotencyResult,
    ttlSeconds: number,
  ): Promise<void> {
    if (this.failNextSave) {
      this.failNextSave = false;
      return Promise.reject(new Error('controlled result persistence failure'));
    }
    return this.delegate.saveResult(key, ownerToken, result, ttlSeconds);
  }

  markFailed(key: string, ownerToken: string): Promise<void> {
    this.markFailedCalls += 1;
    return this.delegate.markFailed(key, ownerToken);
  }
}

describe('Registration transaction and idempotency (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let memoryStore: InMemoryIdempotencyStore;
  let idempotencyStore: ControlledIdempotencyStore;
  const outboxWriter = new ControlledOutboxWriter();
  const runId = randomUUID().replaceAll('-', '');

  beforeAll(async () => {
    memoryStore = new InMemoryIdempotencyStore(
      new ConfigService({
        infrastructureFallback: {
          inMemoryStoreMaxEntries: 1000,
          inMemoryStoreSweepIntervalMs: 60_000,
        },
        idempotency: { maxResponseBytes: 1_048_576 },
      }),
    );
    idempotencyStore = new ControlledIdempotencyStore(memoryStore);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(IDEMPOTENCY_STORE)
      .useValue(idempotencyStore)
      .overrideProvider(OutboxWriterService)
      .useValue(outboxWriter)
      .compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    const appConfig = app.get(ConfigService).getOrThrow<AppConfig>('app');
    configureApplication(app, appConfig);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (prisma) {
      const users = await prisma.user.findMany({
        where: { email: { startsWith: `registration-${runId}-` } },
        select: { id: true },
      });
      const userIds = users.map(({ id }) => id);
      if (userIds.length > 0) {
        await prisma.outboxEvent.deleteMany({
          where: { aggregateId: { in: userIds } },
        });
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      }
    }
    await app?.close();
    memoryStore?.onModuleDestroy();
  });

  it('commits user, verification and outbox then replays the same response', async () => {
    const payload = registrationPayload('replay');
    const key = `registration-replay-${runId}`;

    const first = await register(payload, key).expect(201);
    const replay = await register(payload, key).expect(201);

    expect(replay.headers['x-idempotent-replayed']).toBe('true');
    expect(replay.body).toEqual(first.body);
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: payload.email },
    });
    await expect(
      prisma.userToken.count({ where: { userId: user.id } }),
    ).resolves.toBe(1);
    const events = await prisma.outboxEvent.findMany({
      where: { aggregateId: user.id },
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      aggregateType: 'mail',
      eventType: 'mail.send.v1',
      status: 'PENDING',
    });
    expect(JSON.stringify(events[0].payload)).not.toContain(payload.password);
  });

  it('rejects changed payload and excludes an in-flight duplicate', async () => {
    const conflictPayload = registrationPayload('conflict');
    const conflictKey = `registration-conflict-${runId}`;
    await register(conflictPayload, conflictKey).expect(201);
    await register(
      { ...conflictPayload, displayName: 'Different Name' },
      conflictKey,
    ).expect(409);

    const concurrentPayload = registrationPayload('concurrent');
    const concurrentKey = `registration-concurrent-${runId}`;
    const responses = await Promise.all([
      register(concurrentPayload, concurrentKey),
      register(concurrentPayload, concurrentKey),
    ]);
    expect(responses.map(({ status }) => status).sort()).toEqual([201, 409]);
    await expect(
      prisma.user.count({ where: { email: concurrentPayload.email } }),
    ).resolves.toBe(1);
  });

  it('rolls back business state on outbox failure and releases the lease', async () => {
    const payload = registrationPayload('rollback');
    const key = `registration-rollback-${runId}`;
    const failedCallsBefore = idempotencyStore.markFailedCalls;
    outboxWriter.fail = true;
    await register(payload, key).expect(503);
    outboxWriter.fail = false;

    await expect(
      prisma.user.findUnique({ where: { email: payload.email } }),
    ).resolves.toBeNull();
    expect(idempotencyStore.markFailedCalls).toBe(failedCallsBefore + 1);

    await register(payload, key).expect(201);
    await expect(
      prisma.user.count({ where: { email: payload.email } }),
    ).resolves.toBe(1);
  });

  it('releases a validation failure so a corrected retry can run', async () => {
    const payload = registrationPayload('validation');
    const key = `registration-validation-${runId}`;

    await register({ ...payload, password: 'weak' }, key).expect(400);
    await register(payload, key).expect(201);
  });

  it('keeps the lease when saving the response fails after commit', async () => {
    const payload = registrationPayload('save-failure');
    const key = `registration-save-failure-${runId}`;
    const failedCallsBefore = idempotencyStore.markFailedCalls;
    idempotencyStore.failNextSave = true;

    await register(payload, key).expect(500);
    await register(payload, key).expect(409);

    expect(idempotencyStore.markFailedCalls).toBe(failedCallsBefore);
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: payload.email },
    });
    await expect(
      prisma.outboxEvent.count({ where: { aggregateId: user.id } }),
    ).resolves.toBe(1);
  });

  function register(
    payload: ReturnType<typeof registrationPayload>,
    idempotencyKey: string,
  ): request.Test {
    return request(app.getHttpServer() as Parameters<typeof request>[0])
      .post('/api/v1/auth/register')
      .set('x-idempotency-key', idempotencyKey)
      .send(payload);
  }

  function registrationPayload(suffix: string) {
    return {
      email: `registration-${runId}-${suffix}@example.test`,
      username: `reg_${runId.slice(0, 12)}_${suffix.replaceAll('-', '_')}`,
      password: 'StrongPassword1!',
      displayName: `Registration ${suffix}`,
    };
  }
});
