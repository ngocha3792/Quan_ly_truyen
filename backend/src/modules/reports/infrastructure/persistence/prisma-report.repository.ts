import { Injectable } from '@nestjs/common';
import {
  Prisma,
  ReportReason,
  ReportStatus,
} from '@/generated/prisma/client';
import { PrismaService } from '@/infrastructure/database';
import {
  ReportAlreadyClosedException,
  ReportNotFoundException,
} from '../../domain';
import type {
  AdminReportListQuery,
  CloseReportPersistenceInput,
} from '../../application/dto';
import type { ReportRepositoryPort } from '../../application/ports/report.repository.port';

@Injectable()
export class PrismaReportRepository implements ReportRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AdminReportListQuery) {
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
          ? { id: row.comment.id, excerpt: excerpt(row.comment.body) }
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

  async get(reportId: string) {
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

  async close(input: CloseReportPersistenceInput) {
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
      const status =
        input.status === 'RESOLVED' ? ReportStatus.RESOLVED : ReportStatus.REJECTED;
      await tx.report.update({
        where: { id: report.id },
        data: {
          status,
          resolutionNote: input.note,
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
          newValues: { status },
          metadata: { commentId: report.commentId },
          ...input.audit,
        },
      });
      return {
        id: report.id,
        status,
        resolvedAt: now.toISOString(),
        resolutionNote: input.note,
      };
    });
  }
}

function excerpt(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length <= 200
    ? normalized
    : `${normalized.slice(0, 197)}...`;
}
