import { Injectable } from '@nestjs/common';
import {
  ModerationActionType,
  ModerationStatus,
  Prisma,
} from '@/generated/prisma/client';
import { PrismaService } from '@/infrastructure/database';
import type {
  BanTargetPersistenceResult,
  ModerateCommentPersistenceResult,
  ModerationPersistencePort,
  WarnUserPersistenceResult,
} from '../../application';

@Injectable()
export class PrismaModerationPersistence implements ModerationPersistencePort {
  constructor(private readonly prisma: PrismaService) {}

  async moderateComment(
    input: Parameters<ModerationPersistencePort['moderateComment']>[0],
  ): Promise<ModerateCommentPersistenceResult> {
    return this.prisma.$transaction(async (tx) => {
      const comment = await this.lockComment(tx, input.commentId);
      if (!comment) return { status: 'comment_not_found' } as const;

      if (
        comment.deletedAt ||
        comment.moderationStatus === 'deleted' ||
        comment.moderationStatus === 'removed' ||
        !input.allowedCurrentStatuses.includes(
          comment.moderationStatus as (typeof input.allowedCurrentStatuses)[number],
        )
      ) {
        return {
          status: 'invalid_transition',
          currentStatus: comment.moderationStatus,
        } as const;
      }

      const reportStatus = await this.reportMatchStatus(
        tx,
        input.reportId,
        comment.id,
      );
      if (reportStatus) return { status: reportStatus } as const;

      const next = ModerationStatus[input.nextStatus];
      const ancestorsPublic = await this.areAncestorsPublic(tx, comment.id);
      const oldPublic =
        ancestorsPublic &&
        comment.moderationStatus === 'visible' &&
        !comment.deletedAt;
      const newPublic = ancestorsPublic && next === ModerationStatus.VISIBLE;

      const visibleDescendants =
        oldPublic !== newPublic
          ? await this.countPublicDescendants(tx, comment.id)
          : 0;

      await tx.comment.update({
        where: { id: comment.id },
        data: { moderationStatus: next },
      });

      if (oldPublic !== newPublic) {
        const amount = 1 + visibleDescendants;
        await this.adjustPublicCounters(
          tx,
          comment.storyId,
          comment.chapterId,
          newPublic ? amount : -amount,
        );
      }

      await tx.moderationAction.create({
        data: {
          actorId: input.actorId,
          reportId: input.reportId,
          commentId: comment.id,
          action: ModerationActionType[input.action],
          reason: input.reason,
          metadata: {
            previousStatus: comment.moderationStatus.toUpperCase(),
            newStatus: next,
          },
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: input.actorId,
          action: input.auditAction,
          entityType: 'comment',
          entityId: comment.id,
          oldValues: {
            moderationStatus: comment.moderationStatus.toUpperCase(),
          },
          newValues: { moderationStatus: next },
          metadata: { reason: input.reason, reportId: input.reportId ?? null },
          ...input.audit,
        },
      });

      return {
        status: 'updated',
        commentId: comment.id,
        moderationStatus: input.nextStatus,
      } as const;
    });
  }

  async warnUser(
    input: Parameters<ModerationPersistencePort['warnUser']>[0],
  ): Promise<WarnUserPersistenceResult> {
    return this.prisma.$transaction(async (tx) => {
      const comment = await this.lockComment(tx, input.commentId);
      if (!comment) return { status: 'comment_not_found' } as const;

      const reportStatus = await this.reportMatchStatus(
        tx,
        input.reportId,
        comment.id,
      );
      if (reportStatus) return { status: reportStatus } as const;

      await tx.moderationAction.create({
        data: {
          actorId: input.actorId,
          reportId: input.reportId,
          commentId: comment.id,
          action: ModerationActionType.WARN_USER,
          reason: input.reason,
          metadata: { delivery: 'in_app_mandatory' },
        },
      });

      await tx.notification.create({
        data: {
          userId: comment.userId,
          type: 'moderation',
          title: 'Cảnh báo từ đội ngũ kiểm duyệt',
          body: input.message,
          data: { commentId: comment.id, reportId: input.reportId ?? null },
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: input.actorId,
          action: 'comment.moderation.user_warned',
          entityType: 'comment',
          entityId: comment.id,
          metadata: {
            targetUserId: comment.userId,
            reason: input.reason,
            reportId: input.reportId ?? null,
          },
          ...input.audit,
        },
      });

      return {
        status: 'warned',
        commentId: comment.id,
        warnedUserId: comment.userId,
      } as const;
    });
  }

  async findBanTarget(
    input: Parameters<ModerationPersistencePort['findBanTarget']>[0],
  ): Promise<BanTargetPersistenceResult> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: input.commentId },
      select: { id: true, userId: true },
    });
    if (!comment) return { status: 'comment_not_found' };

    if (input.reportId) {
      const report = await this.prisma.report.findUnique({
        where: { id: input.reportId },
        select: { commentId: true },
      });
      if (!report) return { status: 'report_not_found' };
      if (report.commentId !== comment.id) return { status: 'report_mismatch' };
    }

    return { status: 'found', commentId: comment.id, userId: comment.userId };
  }

  async recordUserBan(
    input: Parameters<ModerationPersistencePort['recordUserBan']>[0],
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.moderationAction.create({
        data: {
          actorId: input.actorId,
          reportId: input.reportId,
          commentId: input.commentId,
          action: ModerationActionType.BAN_USER,
          reason: input.reason,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: input.actorId,
          action: 'comment.moderation.user_banned',
          entityType: 'comment',
          entityId: input.commentId,
          metadata: {
            targetUserId: input.userId,
            reason: input.reason,
            reportId: input.reportId ?? null,
          },
          ...input.audit,
        },
      });
    });
  }

  private async reportMatchStatus(
    tx: Prisma.TransactionClient,
    reportId: string | undefined,
    commentId: string,
  ): Promise<'report_not_found' | 'report_mismatch' | null> {
    if (!reportId) return null;
    const report = await tx.report.findUnique({
      where: { id: reportId },
      select: { commentId: true },
    });
    if (!report) return 'report_not_found';
    return report.commentId === commentId ? null : 'report_mismatch';
  }

  private async lockComment(
    tx: Prisma.TransactionClient,
    commentId: string,
  ): Promise<{
    id: string;
    storyId: string;
    chapterId: string | null;
    userId: string;
    moderationStatus: string;
    deletedAt: Date | null;
  } | null> {
    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        storyId: string;
        chapterId: string | null;
        userId: string;
        moderationStatus: string;
        deletedAt: Date | null;
      }>
    >(Prisma.sql`
      SELECT "id", "story_id" AS "storyId", "chapter_id" AS "chapterId", "user_id" AS "userId",
             "moderation_status"::text AS "moderationStatus", "deleted_at" AS "deletedAt"
      FROM "comments" WHERE "id" = ${commentId}::uuid FOR UPDATE
    `);
    return rows[0] ?? null;
  }

  private async areAncestorsPublic(
    tx: Prisma.TransactionClient,
    commentId: string,
  ): Promise<boolean> {
    const rows = await tx.$queryRaw<Array<{ blocked: bigint }>>(Prisma.sql`
      WITH RECURSIVE ancestors AS (
        SELECT parent."id", parent."parent_id", parent."moderation_status", parent."deleted_at"
        FROM "comments" current
        JOIN "comments" parent ON parent."id" = current."parent_id"
        WHERE current."id" = ${commentId}::uuid
        UNION ALL
        SELECT parent."id", parent."parent_id", parent."moderation_status", parent."deleted_at"
        FROM "comments" parent
        JOIN ancestors child ON child."parent_id" = parent."id"
      )
      SELECT COUNT(*) FILTER (
        WHERE NOT (
          ("moderation_status" = 'visible'::"moderation_status" AND "deleted_at" IS NULL)
          OR ("moderation_status" = 'deleted'::"moderation_status" AND "deleted_at" IS NOT NULL)
        )
      )::bigint AS "blocked"
      FROM ancestors
    `);
    return Number(rows[0]?.blocked ?? 0n) === 0;
  }

  private async countPublicDescendants(
    tx: Prisma.TransactionClient,
    commentId: string,
  ): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      WITH RECURSIVE thread AS (
        SELECT c."id", c."moderation_status", c."deleted_at", 1 AS depth
        FROM "comments" c
        WHERE c."parent_id" = ${commentId}::uuid
        UNION ALL
        SELECT c."id", c."moderation_status", c."deleted_at", thread.depth + 1
        FROM "comments" c
        JOIN thread ON c."parent_id" = thread."id"
        WHERE thread.depth < 2
          AND thread."moderation_status" IN ('visible'::"moderation_status", 'deleted'::"moderation_status")
      )
      SELECT COUNT(*)::bigint AS "count"
      FROM thread
      WHERE "moderation_status" = 'visible'::"moderation_status" AND "deleted_at" IS NULL
    `);
    return Number(rows[0]?.count ?? 0n);
  }

  private async adjustPublicCounters(
    tx: Prisma.TransactionClient,
    storyId: string,
    chapterId: string | null,
    delta: number,
  ): Promise<void> {
    if (delta === 0) return;
    if (delta > 0) {
      await tx.story.update({
        where: { id: storyId },
        data: { commentCount: { increment: delta } },
      });
      if (chapterId) {
        await tx.chapter.update({
          where: { id: chapterId },
          data: { commentCount: { increment: delta } },
        });
      }
      return;
    }

    const amount = Math.abs(delta);
    await tx.$executeRaw(
      Prisma.sql`UPDATE "stories" SET "comment_count" = GREATEST("comment_count" - ${amount}, 0) WHERE "id" = ${storyId}::uuid`,
    );
    if (chapterId) {
      await tx.$executeRaw(
        Prisma.sql`UPDATE "chapters" SET "comment_count" = GREATEST("comment_count" - ${amount}, 0) WHERE "id" = ${chapterId}::uuid`,
      );
    }
  }
}
