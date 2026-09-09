import { PrismaService } from '@/infrastructure/database';
import { OutboxWriterService } from '@/infrastructure/queue/outbox';
import { claimAuthorJob } from './ai-author-lease';

describe('Durable author job lease', () => {
  function setup(status: string, expiry: Date | null = null) {
    const row = {
      id: 'job',
      userId: 'user',
      storyId: 'story',
      jobType: 'CHAPTER_SUMMARY',
      status,
      leaseExpiresAt: expiry,
    };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      aiAuthorJob: {
        findUnique: jest.fn().mockResolvedValue(row),
        update: jest.fn().mockResolvedValue({
          ...row,
          status: 'PROCESSING',
          leaseToken: 'new-token',
        }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      $transaction: jest.fn((fn: (value: typeof tx) => unknown) =>
        Promise.resolve(fn(tx)),
      ),
    };
    const outbox = { create: jest.fn().mockResolvedValue({}) };
    return {
      tx,
      outbox,
      run: () =>
        claimAuthorJob(
          prisma as unknown as PrismaService,
          outbox as unknown as OutboxWriterService,
          'job',
          'new-token',
        ),
    };
  }
  it('claims and enqueues a delayed recovery event in the same transaction', async () => {
    const { run, outbox, tx } = setup('PENDING');
    const before = Date.now();
    expect(await run()).toMatchObject({ leaseToken: 'new-token' });
    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(outbox.create).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        eventType: 'ai.author-job.v1',
        payload: { version: 1, jobId: 'job' },
        availableAt: expect.any(Date) as unknown,
      }),
    );
    expect(
      (
        (outbox.create.mock.calls[0] as unknown[])[1] as { availableAt: Date }
      ).availableAt.getTime(),
    ).toBeGreaterThanOrEqual(before + 125_000);
  });
  it.each(['CANCELLED', 'COMPLETED', 'FAILED'])(
    'does not reclaim terminal %s jobs',
    async (status) => {
      const { run, outbox, tx } = setup(status);
      expect(await run()).toBeNull();
      expect(tx.aiAuthorJob.update).not.toHaveBeenCalled();
      expect(outbox.create).not.toHaveBeenCalled();
    },
  );
  it('does not consume active leases twice', async () => {
    const { run, tx } = setup('PROCESSING', new Date(Date.now() + 120_000));
    expect(await run()).toBeNull();
    expect(tx.aiAuthorJob.update).not.toHaveBeenCalled();
  });
  it('fails a crashed worker for explicit retry instead of another automatic charge', async () => {
    const { run, tx, outbox } = setup('PROCESSING', new Date(Date.now() - 1));
    expect(await run()).toBeNull();
    expect(tx.aiAuthorJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'FAILED',
          failureReason: 'WORKER_LEASE_EXPIRED',
          leaseToken: null,
        }) as unknown,
      }),
    );
    expect(tx.auditLog.create).toHaveBeenCalled();
    expect(outbox.create).not.toHaveBeenCalled();
  });
});
