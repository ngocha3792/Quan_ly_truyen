import { Injectable } from '@nestjs/common';
import {
  ModerationActionType,
  ModerationStatus,
  Prisma,
  ReportReason,
  ReportStatus,
} from '@/generated/prisma/client';
import { PrismaService } from '@/infrastructure/database';
import { MetricsService } from '@/infrastructure/observability';
import {
  UpdateManagedUserStatusCommand,
  UpdateManagedUserStatusCommandHandler,
} from '@/modules/users/application';
import { ManagedUserStatus } from '@/modules/users/domain';
import { CommentNotFoundException } from '@/modules/comments';
import {
  InvalidCommentModerationTransitionException,
  InvalidModerationReasonException,
  InvalidReportResolutionException,
  InvalidWarningMessageException,
  ModerationReportMismatchException,
  ReportAlreadyClosedException,
  ReportNotFoundException,
} from '../domain';
import type {
  AdminReportListQuery,
  CommentModerationOperation,
} from './moderation.models';

interface AuditContext {
  readonly ipAddress?: string;
  readonly userAgent?: string;
  readonly requestId?: string;
}

@Injectable()
export class ModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly updateUserStatus: UpdateManagedUserStatusCommandHandler,
    private readonly metrics: MetricsService,
  ) {}

  async listReports(query: AdminReportListQuery) {
    const page = Math.max(1, query.page);
    const pageSize = Math.min(100, Math.max(1, query.pageSize));
    const searchReporter = query.reporter?.trim();
    const searchReported = query.reportedUser?.trim();
    const where: Prisma.ReportWhereInput = {
      targetType: 'COMMENT',
      ...(query.status ? { status: query.status as ReportStatus } : {}),
      ...(query.reason ? { reason: query.reason as ReportReason } : {}),
      ...(query.createdFrom || query.createdTo
        ? {
            createdAt: {
              ...(query.createdFrom ? { gte: query.createdFrom } : {}),
              ...(query.createdTo ? { lte: query.createdTo } : {}),
            },
          }
        : {}),
      ...(searchReporter
        ? {
            reporter: {
              OR: [
                {
                  displayName: {
                    contains: searchReporter,
                    mode: 'insensitive',
                  },
                },
                { email: { contains: searchReporter, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
      ...(searchReported
        ? {
            reportedUser: {
              OR: [
                {
                  displayName: {
                    contains: searchReported,
                    mode: 'insensitive',
                  },
                },
                { email: { contains: searchReported, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    };
    const direction = query.direction ?? 'desc';
    const primary = query.sort ?? 'createdAt';
    const orderBy: Prisma.ReportOrderByWithRelationInput[] = [
      { [primary]: direction },
      ...(primary === 'createdAt' ? [] : [{ createdAt: 'desc' as const }]),
      { id: 'desc' },
    ];
    const [totalItems, rows] = await this.prisma.$transaction([
      this.prisma.report.count({ where }),
      this.prisma.report.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          status: true,
          reason: true,
          createdAt: true,
          reporter: { select: { id: true, displayName: true } },
          reportedUser: { select: { id: true, displayName: true } },
          comment: { select: { id: true, body: true } },
          story: { select: { id: true, title: true } },
          chapter: { select: { id: true, title: true } },
        },
      }),
    ]);
    return {
      items: rows.map((row) => ({
        id: row.id,
        status: row.status,
        reason: row.reason,
        createdAt: row.createdAt.toISOString(),
        reporter: row.reporter,
        reportedUser: row.reportedUser,
        comment: row.comment
          ? { id: row.comment.id, excerpt: this.excerpt(row.comment.body) }
          : null,
        story: row.story,
        chapter: row.chapter,
      })),
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize),
      },
    };
  }

  async getReport(reportId: string) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      select: {
        id: true,
        reason: true,
        description: true,
        status: true,
        evidence: true,
        resolutionNote: true,
        createdAt: true,
        updatedAt: true,
        resolvedAt: true,
        reporter: { select: { id: true, displayName: true, email: true } },
        reportedUser: {
          select: { id: true, displayName: true, email: true, status: true },
        },
        comment: {
          select: {
            id: true,
            body: true,
            moderationStatus: true,
            editedAt: true,
            createdAt: true,
            deletedAt: true,
            storyId: true,
            chapterId: true,
            user: { select: { id: true, displayName: true, status: true } },
          },
        },
        story: { select: { id: true, slug: true, title: true } },
        chapter: { select: { id: true, number: true, title: true } },
        moderationActions: {
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 50,
          select: {
            id: true,
            actorId: true,
            action: true,
            reason: true,
            metadata: true,
            createdAt: true,
          },
        },
      },
    });
    if (!report) throw new ReportNotFoundException(reportId);
    const relatedReportCount = report.comment
      ? await this.prisma.report.count({
          where: { commentId: report.comment.id },
        })
      : 0;
    const recentUserModerationCount = report.reportedUser
      ? await this.prisma.moderationAction.count({
          where: {
            targetUserId: report.reportedUser.id,
            createdAt: { gte: new Date(Date.now() - 90 * 86_400_000) },
          },
        })
      : 0;
    return {
      ...report,
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt.toISOString(),
      resolvedAt: report.resolvedAt?.toISOString() ?? null,
      currentComment: report.comment
        ? {
            ...report.comment,
            editedAt: report.comment.editedAt?.toISOString() ?? null,
            createdAt: report.comment.createdAt.toISOString(),
            deletedAt: report.comment.deletedAt?.toISOString() ?? null,
          }
        : null,
      comment: undefined,
      relatedReportCount,
      recentUserModerationCount,
      moderationActions: report.moderationActions.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
      })),
    };
  }

  resolveReport(input: {
    actorId: string;
    reportId: string;
    note: string;
    audit: AuditContext;
  }) {
    return this.closeReport({
      ...input,
      status: ReportStatus.RESOLVED,
      auditAction: 'comment.report.resolved',
    });
  }

  rejectReport(input: {
    actorId: string;
    reportId: string;
    note: string;
    audit: AuditContext;
  }) {
    return this.closeReport({
      ...input,
      status: ReportStatus.REJECTED,
      auditAction: 'comment.report.rejected',
    });
  }

  async moderateComment(input: {
    actorId: string;
    commentId: string;
    operation: CommentModerationOperation;
    reason: string;
    reportId?: string;
    audit: AuditContext;
  }) {
    const reason = this.reason(input.reason);
    const result = await this.prisma.$transaction(async (tx) => {
      const comment = await this.lockComment(tx, input.commentId);
      if (!comment) throw new CommentNotFoundException(input.commentId);
      if (
        comment.deletedAt ||
        comment.moderationStatus === 'deleted' ||
        comment.moderationStatus === 'removed'
      ) {
        throw new InvalidCommentModerationTransitionException(
          comment.moderationStatus.toUpperCase(),
          input.operation.toUpperCase(),
        );
      }
      await this.assertReportMatches(tx, input.reportId, comment.id);

      const next = this.nextStatus(comment.moderationStatus, input.operation);
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

      const action = this.actionFor(input.operation);
      await tx.moderationAction.create({
        data: {
          actorId: input.actorId,
          reportId: input.reportId,
          commentId: comment.id,
          action,
          reason,
          metadata: {
            previousStatus: comment.moderationStatus.toUpperCase(),
            newStatus: next,
          },
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: input.actorId,
          action: this.auditActionFor(input.operation),
          entityType: 'comment',
          entityId: comment.id,
          oldValues: {
            moderationStatus: comment.moderationStatus.toUpperCase(),
          },
          newValues: { moderationStatus: next },
          metadata: { reason, reportId: input.reportId ?? null },
          ...input.audit,
        },
      });
      return { commentId: comment.id, moderationStatus: next };
    });
    this.metrics.recordCommentModeration(input.operation);
    return result;
  }

  async warnUser(input: {
    actorId: string;
    commentId: string;
    message: string;
    reason: string;
    reportId?: string;
    audit: AuditContext;
  }) {
    const reason = this.reason(input.reason);
    const message = input.message.normalize('NFKC').trim();
    if (message.length < 10 || message.length > 1000)
      throw new InvalidWarningMessageException();
    const result = await this.prisma.$transaction(async (tx) => {
      const comment = await this.lockComment(tx, input.commentId);
      if (!comment) throw new CommentNotFoundException(input.commentId);
      await this.assertReportMatches(tx, input.reportId, comment.id);
      await tx.moderationAction.create({
        data: {
          actorId: input.actorId,
          reportId: input.reportId,
          commentId: comment.id,
          action: ModerationActionType.WARN_USER,
          reason,
          metadata: { delivery: 'in_app_mandatory' },
        },
      });
      // Explicit moderation warnings are mandatory in-app notices; marketing preferences do not suppress them.
      await tx.notification.create({
        data: {
          userId: comment.userId,
          type: 'moderation',
          title: 'Cảnh báo từ đội ngũ kiểm duyệt',
          body: message,
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
            reason,
            reportId: input.reportId ?? null,
          },
          ...input.audit,
        },
      });
      return { commentId: comment.id, warnedUserId: comment.userId };
    });
    this.metrics.recordCommentModeration('warn');
    return {
      success: true as const,
      commentId: result.commentId,
      warnedUserId: result.warnedUserId,
    };
  }

  async banUser(input: {
    actorId: string;
    commentId: string;
    reason: string;
    reportId?: string;
    audit: AuditContext;
  }) {
    const reason = this.reason(input.reason);
    const comment = await this.prisma.comment.findUnique({
      where: { id: input.commentId },
      select: {
        id: true,
        userId: true,
        storyId: true,
        chapterId: true,
        moderationStatus: true,
      },
    });
    if (!comment) throw new CommentNotFoundException(input.commentId);
    if (input.reportId) {
      const report = await this.prisma.report.findUnique({
        where: { id: input.reportId },
        select: { commentId: true },
      });
      if (!report) throw new ReportNotFoundException(input.reportId);
      if (report.commentId !== comment.id)
        throw new ModerationReportMismatchException();
    }

    // Reuse Phase 1 user lifecycle: this performs last-admin/self protection, session revocation and auth invalidation.
    await this.updateUserStatus.execute(
      new UpdateManagedUserStatusCommand(
        input.actorId,
        comment.userId,
        ManagedUserStatus.BANNED,
        input.audit.ipAddress,
        input.audit.userAgent,
        input.audit.requestId,
        reason,
      ),
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.moderationAction.create({
        data: {
          actorId: input.actorId,
          reportId: input.reportId,
          commentId: comment.id,
          action: ModerationActionType.BAN_USER,
          reason,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: input.actorId,
          action: 'comment.moderation.user_banned',
          entityType: 'comment',
          entityId: comment.id,
          metadata: {
            targetUserId: comment.userId,
            reason,
            reportId: input.reportId ?? null,
          },
          ...input.audit,
        },
      });
    });
    this.metrics.recordCommentModeration('ban');
    return { success: true as const, userId: comment.userId };
  }

  private async closeReport(input: {
    actorId: string;
    reportId: string;
    note: string;
    status: typeof ReportStatus.RESOLVED | typeof ReportStatus.REJECTED;
    auditAction: string;
    audit: AuditContext;
  }) {
    const note = input.note.normalize('NFKC').trim();
    if (note.length < 10 || note.length > 2000)
      throw new InvalidReportResolutionException();
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{ id: string; status: string; commentId: string | null }>
      >(Prisma.sql`
        SELECT "id", "status"::text AS "status", "comment_id" AS "commentId"
        FROM "reports" WHERE "id" = ${input.reportId}::uuid FOR UPDATE
      `);
      const report = rows[0];
      if (!report) throw new ReportNotFoundException(input.reportId);
      if (!['open', 'in_review'].includes(report.status))
        throw new ReportAlreadyClosedException();
      const now = new Date();
      await tx.report.update({
        where: { id: report.id },
        data: {
          status: input.status,
          resolutionNote: note,
          resolvedAt: now,
          assignedToId: input.actorId,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: input.actorId,
          action: input.auditAction,
          entityType: 'report',
          entityId: report.id,
          oldValues: { status: report.status.toUpperCase() },
          newValues: { status: input.status },
          metadata: { commentId: report.commentId },
          ...input.audit,
        },
      });
      return {
        id: report.id,
        status: input.status,
        resolvedAt: now.toISOString(),
        resolutionNote: note,
      };
    });
  }

  private nextStatus(
    current: string,
    operation: CommentModerationOperation,
  ): ModerationStatus {
    const table: Record<CommentModerationOperation, readonly string[]> = {
      hold: ['visible'],
      hide: ['visible', 'pending'],
      restore: ['pending', 'hidden'],
      remove: ['visible', 'pending', 'hidden'],
    };
    if (!table[operation].includes(current)) {
      throw new InvalidCommentModerationTransitionException(
        current.toUpperCase(),
        operation.toUpperCase(),
      );
    }
    switch (operation) {
      case 'hold':
        return ModerationStatus.PENDING;
      case 'hide':
        return ModerationStatus.HIDDEN;
      case 'restore':
        return ModerationStatus.VISIBLE;
      case 'remove':
        return ModerationStatus.REMOVED;
    }
  }

  private auditActionFor(operation: CommentModerationOperation): string {
    switch (operation) {
      case 'hold':
        return 'comment.moderation.held';
      case 'hide':
        return 'comment.moderation.hidden';
      case 'restore':
        return 'comment.moderation.restored';
      case 'remove':
        return 'comment.moderation.removed';
    }
  }

  private actionFor(
    operation: CommentModerationOperation,
  ): ModerationActionType {
    switch (operation) {
      case 'hold':
        return ModerationActionType.HOLD_COMMENT;
      case 'hide':
        return ModerationActionType.HIDE_COMMENT;
      case 'restore':
        return ModerationActionType.RESTORE_COMMENT;
      case 'remove':
        return ModerationActionType.DELETE_COMMENT;
    }
  }

  private async assertReportMatches(
    tx: Prisma.TransactionClient,
    reportId: string | undefined,
    commentId: string,
  ) {
    if (!reportId) return;
    const report = await tx.report.findUnique({
      where: { id: reportId },
      select: { commentId: true },
    });
    if (!report) throw new ReportNotFoundException(reportId);
    if (report.commentId !== commentId)
      throw new ModerationReportMismatchException();
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
  ) {
    if (delta === 0) return;
    if (delta > 0) {
      await tx.story.update({
        where: { id: storyId },
        data: { commentCount: { increment: delta } },
      });
      if (chapterId)
        await tx.chapter.update({
          where: { id: chapterId },
          data: { commentCount: { increment: delta } },
        });
      return;
    }
    const amount = Math.abs(delta);
    await tx.$executeRaw(
      Prisma.sql`UPDATE "stories" SET "comment_count" = GREATEST("comment_count" - ${amount}, 0) WHERE "id" = ${storyId}::uuid`,
    );
    if (chapterId)
      await tx.$executeRaw(
        Prisma.sql`UPDATE "chapters" SET "comment_count" = GREATEST("comment_count" - ${amount}, 0) WHERE "id" = ${chapterId}::uuid`,
      );
  }

  private reason(value: string): string {
    const normalized = value.normalize('NFKC').trim().replace(/\s+/g, ' ');
    if (normalized.length < 10 || normalized.length > 2000)
      throw new InvalidModerationReasonException();
    return normalized;
  }

  private excerpt(value: string): string {
    const normalized = value.replace(/\s+/g, ' ').trim();
    return normalized.length <= 200
      ? normalized
      : `${normalized.slice(0, 197)}...`;
  }
}
