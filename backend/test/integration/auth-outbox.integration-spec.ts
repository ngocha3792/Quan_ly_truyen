import { randomUUID } from 'node:crypto';

import { ConfigService } from '@nestjs/config';

import { Queue } from 'bullmq';

import { OutboxStatus } from '@/generated/prisma/enums';

import { PrismaService } from '@/infrastructure/database';

import { createRedisConnectionOptions } from '@/infrastructure/cache/redis';

import { SEND_MAIL_JOB } from '@/infrastructure/queue/contracts';

import { OutboxDispatcherService } from '@/infrastructure/queue/outbox';

describe('Auth outbox to BullMQ integration', () => {
  let prisma: PrismaService;

  let queue: Queue;

  const queueName = `mail-integration-${randomUUID()}`;

  beforeAll(async () => {
    const databaseUrl = process.env.TEST_DATABASE_URL;

    const redisUrl = process.env.TEST_REDIS_URL;

    if (!databaseUrl || !redisUrl) {
      throw new Error(
        'TEST_DATABASE_URL and TEST_REDIS_URL are required',
      );
    }

    prisma = new PrismaService(
      new ConfigService({
        database: {
          url: databaseUrl,
        },

        app: {
          environment: 'test',
        },
      }),
    );

    await prisma.$connect();

    queue = new Queue(
      queueName,

      {
        prefix: `qlt:test:outbox:${process.pid}`,

        connection: createRedisConnectionOptions(
          redisUrl,

          {
            connectTimeout: 5_000,

            maxRetriesPerRequest: null,
          },
        ),
      },
    );

    await queue.waitUntilReady();
  });

  beforeEach(async () => {
    /*
     * Dọn fixture cũ trước test.
     *
     * Nếu một lần chạy trước bị dừng giữa chừng, pending outbox
     * event không được phép làm dispatchBatch() trả về 2.
     */
    await cleanupOutboxTestArtifacts();
  });

  afterEach(async () => {
    await cleanupOutboxTestArtifacts();
  });

  afterAll(async () => {
    /*
     * Cố gắng dọn lần cuối trước khi đóng connection.
     */
    await cleanupOutboxTestArtifacts();

    await queue.close();

    await prisma.$disconnect();
  });

  it('claims a mail outbox event, adds a BullMQ job and marks it published', async () => {
    const event = await prisma.outboxEvent.create({
      data: {
        aggregateType: 'mail',

        aggregateId: randomUUID(),

        eventType: SEND_MAIL_JOB,

        idempotencyKey: `integration:${randomUUID()}`,

        payload: {
          version: 1,

          algorithm: 'aes-256-gcm',

          iv: Buffer.alloc(
            12,

            1,
          ).toString('base64'),

          ciphertext: Buffer.from(
            'encrypted-test-payload',
          ).toString('base64'),

          authTag: Buffer.alloc(
            16,

            2,
          ).toString('base64'),
        },

        status: OutboxStatus.PENDING,

        availableAt: new Date(),
      },
    });

    const configService = new ConfigService({
      queue: {
        defaultAttempts: 3,

        defaultBackoffMs: 5_000,

        outboxBatchSize: 10,

        outboxProcessingTimeoutMs: 60_000,

        mailJobRetention: {
          completedAgeSeconds: 3_600,

          completedCount: 100,

          failedAgeSeconds: 604_800,

          failedCount: 1_000,
        },
      },
    });

    const metrics = {
      recordOutbox: jest.fn(),

      recordOutboxStaleRecovered: jest.fn(),
    };

    const tracing = {
      inSpan: jest.fn(
        (
          _name: unknown,

          _attributes: unknown,

          work: () => Promise<unknown>,
        ) => work(),
      ),
    };

    const propagation = {
      parse: jest.fn().mockReturnValue(
        undefined,
      ),

      runWithExtractedContext: jest.fn(
        (
          _metadata: unknown,

          work: () => Promise<unknown>,
        ) => work(),
      ),
    };

    const dispatcher =
      new OutboxDispatcherService(
        prisma,

        configService,

        queue,

        metrics as never,

        tracing as never,

        propagation as never,
      );

    /*
     * Database đã được làm sạch trước test nên chỉ event vừa tạo
     * được claim và publish.
     */
    await expect(
      dispatcher.dispatchBatch(10),
    ).resolves.toBe(1);

    const job = await queue.getJob(
      `outbox-${event.id}`,
    );

    expect(job).not.toBeNull();

    expect(job?.name).toBe(
      SEND_MAIL_JOB,
    );

    expect(job?.data).toMatchObject({
      aggregateType: 'mail',

      aggregateId: event.aggregateId,

      eventType: SEND_MAIL_JOB,

      outboxEventId: event.id,

      payload: {
        algorithm: 'aes-256-gcm',
      },
    });

    const persisted =
      await prisma.outboxEvent.findUniqueOrThrow(
        {
          where: {
            id: event.id,
          },
        },
      );

    expect(persisted.status).toBe(
      OutboxStatus.PUBLISHED,
    );

    expect(
      persisted.processedAt,
    ).not.toBeNull();
  });

  async function cleanupOutboxTestArtifacts(): Promise<void> {
    /*
     * Chỉ dọn mail outbox fixture, không xóa các loại outbox
     * event khác nếu integration suite được mở rộng sau này.
     */
    await prisma.outboxEvent.deleteMany({
      where: {
        aggregateType: 'mail',

        eventType: SEND_MAIL_JOB,
      },
    });

    /*
     * Queue có name/prefix riêng nhưng vẫn dọn để watch mode
     * và các lần rerun trong cùng process luôn cô lập.
     */
    await queue.drain(true);

    await queue.clean(
      0,

      10_000,

      'completed',
    );

    await queue.clean(
      0,

      10_000,

      'failed',
    );
  }
});