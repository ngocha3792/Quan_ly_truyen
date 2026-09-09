import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/infrastructure/database';
import { OutboxWriterService } from '@/infrastructure/queue/outbox';
import type { AiAuthorPersistencePort } from '../../application/author-tools/ai-author.persistence.port';
import {
  AuthorJobError,
  type AuthorJob,
  type AuthorJobUsage,
  type AuthorResult,
  type AuthorSourceSnapshot,
  type CreateAuthorJob,
} from '../../application/author-tools/ai-author.types';
import { assertSourceUnchanged } from '../../application/author-tools/ai-author-output';
import {
  assertAuthorToolAccess,
  loadAuthorSource,
  lockAuthorStory,
} from './ai-author-source';
import { persistAuthorResults, writeAuthorAudit } from './ai-author-results';
import { AiAuthorKnowledgePersistence } from './ai-author-knowledge.persistence';
import { claimAuthorJob } from './ai-author-lease';

function asJob(row: unknown): AuthorJob {
  return row as AuthorJob;
}
@Injectable()
export class PrismaAiAuthorPersistence implements AiAuthorPersistencePort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxWriterService,
    private readonly knowledge: AiAuthorKnowledgePersistence,
  ) {}
  assertAccess(userId: string, storyId: string) {
    return assertAuthorToolAccess(this.prisma, userId, storyId);
  }
  source(
    input: Pick<
      CreateAuthorJob,
      'userId' | 'storyId' | 'chapterId' | 'jobType'
    >,
  ) {
    return loadAuthorSource(this.prisma, input);
  }
  async create(
    input: CreateAuthorJob,
    snapshot: AuthorSourceSnapshot,
  ): Promise<AuthorJob> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM users WHERE id = ${input.userId}::uuid FOR NO KEY UPDATE`,
      );
      await lockAuthorStory(tx, input.storyId);
      assertSourceUnchanged(snapshot, await loadAuthorSource(tx, input));
      const active = await tx.aiAuthorJob.findMany({
        where: {
          userId: input.userId,
          status: { in: ['PENDING', 'PROCESSING'] },
        },
        take: 4,
      });
      const duplicate = active.find(
        (j) =>
          j.storyId === input.storyId &&
          j.chapterId === (input.chapterId ?? null) &&
          j.jobType === input.jobType &&
          j.connectionId === input.connectionId &&
          (j.sourceSnapshot as unknown as AuthorSourceSnapshot).storyVersion ===
            snapshot.storyVersion &&
          (j.sourceSnapshot as unknown as AuthorSourceSnapshot)
            .charactersHash === snapshot.charactersHash &&
          (j.sourceSnapshot as unknown as AuthorSourceSnapshot).chapters.every(
            (chapter, index) =>
              chapter.hash === snapshot.chapters[index]?.hash &&
              chapter.id === snapshot.chapters[index]?.id &&
              chapter.version === snapshot.chapters[index]?.version,
          ) &&
          (j.sourceSnapshot as unknown as AuthorSourceSnapshot).chapters
            .length === snapshot.chapters.length,
      );
      if (duplicate) return asJob(duplicate);
      if (active.length >= 3) throw new AuthorJobError('TOO_MANY_ACTIVE_JOBS');
      const job = await tx.aiAuthorJob.create({
        data: {
          id: randomUUID(),
          userId: input.userId,
          storyId: input.storyId,
          chapterId: input.chapterId,
          jobType: input.jobType,
          connectionId: input.connectionId,
          sourceSnapshot: snapshot as unknown as Prisma.InputJsonValue,
        },
      });
      await this.enqueue(tx, job.id, 0);
      await writeAuthorAudit(tx, asJob(job), 'created');
      return asJob(job);
    });
  }
  async find(id: string): Promise<AuthorJob | null> {
    const job = await this.prisma.aiAuthorJob.findUnique({ where: { id } });
    return job ? asJob(job) : null;
  }
  async list(userId: string, storyId: string): Promise<AuthorJob[]> {
    await this.assertAccess(userId, storyId);
    return (
      await this.prisma.aiAuthorJob.findMany({
        where: { userId, storyId },
        orderBy: { createdAt: 'desc' },
        take: 30,
      })
    ).map(asJob);
  }
  async transition(
    userId: string,
    storyId: string,
    id: string,
    action: 'cancel' | 'retry',
  ): Promise<AuthorJob> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM users WHERE id = ${userId}::uuid FOR NO KEY UPDATE`,
      );
      await lockAuthorStory(tx, storyId);
      await assertAuthorToolAccess(tx, userId, storyId);
      const job = await tx.aiAuthorJob.findFirst({
        where: { id, userId, storyId },
      });
      if (!job) throw new AuthorJobError('NOT_FOUND');
      if (action === 'retry') {
        const active = await tx.aiAuthorJob.count({
          where: { userId, status: { in: ['PENDING', 'PROCESSING'] } },
        });
        if (active >= 3) throw new AuthorJobError('TOO_MANY_ACTIVE_JOBS');
        if (job.status !== 'FAILED' || job.retryCount >= 2)
          throw new AuthorJobError('RETRY_NOT_ALLOWED');
        const update = await tx.aiAuthorJob.updateMany({
          where: { id, status: 'FAILED', retryCount: job.retryCount },
          data: {
            status: 'PENDING',
            failureReason: null,
            leaseToken: null,
            leaseExpiresAt: null,
            completedAt: null,
            retryCount: { increment: 1 },
          },
        });
        if (!update.count) throw new AuthorJobError('JOB_CHANGED');
        await this.enqueue(tx, id, job.retryCount + 1);
      } else {
        await tx.aiAuthorJob.updateMany({
          where: { id, status: { in: ['PENDING', 'PROCESSING'] } },
          data: {
            status: 'CANCELLED',
            leaseToken: null,
            leaseExpiresAt: null,
            completedAt: new Date(),
          },
        });
      }
      await writeAuthorAudit(tx, asJob(job), action);
      return asJob(await tx.aiAuthorJob.findUniqueOrThrow({ where: { id } }));
    });
  }
  async claim(id: string, leaseToken: string): Promise<AuthorJob | null> {
    return claimAuthorJob(this.prisma, this.outbox, id, leaseToken);
  }
  async complete(
    job: AuthorJob,
    result: AuthorResult,
    usage: AuthorJobUsage,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      await lockAuthorStory(tx, job.storyId);
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM chapters WHERE story_id = ${job.storyId}::uuid AND deleted_at IS NULL FOR SHARE`,
      );
      const source = await loadAuthorSource(tx, {
        ...job,
        chapterId: job.chapterId ?? undefined,
      });
      assertSourceUnchanged(job.sourceSnapshot, source);
      const changed = await tx.aiAuthorJob.updateMany({
        where: {
          id: job.id,
          status: 'PROCESSING',
          leaseToken: job.leaseToken,
          leaseExpiresAt: { gt: new Date() },
        },
        data: {
          status: 'COMPLETED',
          result: result as unknown as Prisma.InputJsonValue,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          protocol: usage.protocol,
          model: usage.model,
          completedAt: new Date(),
          leaseToken: null,
          leaseExpiresAt: null,
        },
      });
      if (!changed.count) return false;
      await persistAuthorResults(tx, job, result);
      await writeAuthorAudit(tx, job, 'completed', {
        ...usage,
        totalCost: null,
        costStatus: 'UNAVAILABLE',
      });
      return true;
    });
  }
  async fail(job: AuthorJob, code: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.aiAuthorJob.updateMany({
        where: { id: job.id, status: 'PROCESSING', leaseToken: job.leaseToken },
        data: {
          status: 'FAILED',
          failureReason: code,
          leaseToken: null,
          leaseExpiresAt: null,
          completedAt: new Date(),
        },
      });
      if (changed.count)
        await writeAuthorAudit(tx, job, 'failed', { errorCode: code });
    });
  }
  characters(userId: string, storyId: string) {
    return this.knowledge.characters(userId, storyId);
  }
  verifyCharacter(
    userId: string,
    storyId: string,
    id: string,
    isVerified: boolean,
  ) {
    return this.knowledge.verifyCharacter(userId, storyId, id, isVerified);
  }
  issues(userId: string, storyId: string, chapterId?: string) {
    return this.knowledge.issues(userId, storyId, chapterId);
  }
  updateIssue(
    userId: string,
    storyId: string,
    id: string,
    patch: { isDismissed?: boolean; isResolved?: boolean },
  ) {
    return this.knowledge.updateIssue(userId, storyId, id, patch);
  }
  private async enqueue(
    tx: Prisma.TransactionClient,
    jobId: string,
    attempt: number,
  ): Promise<void> {
    await this.outbox.create(tx, {
      aggregateType: 'ai',
      aggregateId: jobId,
      eventType: 'ai.author-job.v1',
      idempotencyKey: `ai.author-job.${jobId}.${attempt}`,
      payload: { version: 1, jobId },
    });
  }
}
