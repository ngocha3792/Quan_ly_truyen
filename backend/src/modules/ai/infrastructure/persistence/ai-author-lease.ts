import { Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/infrastructure/database';
import { OutboxWriterService } from '@/infrastructure/queue/outbox';
import type { AuthorJob } from '../../application/author-tools/ai-author.types';
import { writeAuthorAudit } from './ai-author-results';

export function claimAuthorJob(
  prisma: PrismaService,
  outbox: OutboxWriterService,
  id: string,
  leaseToken: string,
): Promise<AuthorJob | null> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM ai_author_jobs WHERE id = ${id}::uuid FOR UPDATE`,
    );
    const row = await tx.aiAuthorJob.findUnique({ where: { id } });
    if (!row) return null;
    const now = new Date();
    if (
      row.status === 'PROCESSING' &&
      row.leaseExpiresAt &&
      row.leaseExpiresAt <= now
    ) {
      await tx.aiAuthorJob.update({
        where: { id },
        data: {
          status: 'FAILED',
          failureReason: 'WORKER_LEASE_EXPIRED',
          leaseToken: null,
          leaseExpiresAt: null,
          completedAt: now,
        },
      });
      await writeAuthorAudit(tx, row as unknown as AuthorJob, 'failed', {
        errorCode: 'WORKER_LEASE_EXPIRED',
      });
      return null;
    }
    if (row.status !== 'PENDING') return null;
    const leaseExpiresAt = new Date(now.getTime() + 120_000);
    const claimed = await tx.aiAuthorJob.update({
      where: { id },
      data: {
        status: 'PROCESSING',
        startedAt: now,
        leaseToken,
        leaseExpiresAt,
      },
    });
    // Durable watchdog recovers a crashed worker without automatically charging another provider call.
    await outbox.create(tx, {
      aggregateType: 'ai',
      aggregateId: id,
      eventType: 'ai.author-job.v1',
      idempotencyKey: `ai.author-watchdog.${id}.${leaseToken}`,
      availableAt: new Date(leaseExpiresAt.getTime() + 5_000),
      payload: { version: 1, jobId: id },
    });
    return claimed as unknown as AuthorJob;
  });
}
