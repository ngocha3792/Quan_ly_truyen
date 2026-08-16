import { Injectable } from '@nestjs/common';
import {
  MediaPurpose,
  MediaResourceType,
  MediaStatus,
  ModerationStatus,
  Prisma,
  ReactionType,
  ReportReason,
  ReportTargetType,
} from '@/generated/prisma/client';
import { PrismaService } from '@/infrastructure/database';
import { MetricsService } from '@/infrastructure/observability';
import {
  CommentNotFoundException,
  CommentNotReactableException,
  CommentNotReportableException,
  CommentNotReplyableException,
  CommentReplyDepthExceededException,
  CommentSelfReportNotAllowedException,
  InvalidReportException,
  ReportAlreadyOpenException,
  CommentPolicy,
} from '../domain';
import { AbuseRateLimiterService } from './abuse-rate-limiter.service';
import { CommentWriteAbuseService } from './comment-write-abuse.service';
import type {
  CommentPageView,
  CommentReportView,
  CommentView,
  ReactionName,
  ReactionSummaryView,
  ReportReasonName,
} from './comment.models';

const REACTION_NAMES: readonly ReactionName[] = [
  'LIKE',
  'LOVE',
  'LAUGH',
  'INSIGHTFUL',
];

const COMMENT_VIEW_SELECT = {
  id: true,
  storyId: true,
  chapterId: true,
  parentId: true,
  body: true,
  moderationStatus: true,
  deletedAt: true,
  likeCount: true,
  replyCount: true,
  editedAt: true,
  createdAt: true,
  updatedAt: true,
  parent: { select: { parentId: true } },
  user: {
    select: {
      id: true,
      displayName: true,
      avatarMedia: {
        select: {
          purpose: true,
          status: true,
          resourceType: true,
          secureUrl: true,
          publicUrl: true,
          deletedAt: true,
        },
      },
    },
  },
} satisfies Prisma.CommentSelect;

type CommentViewRow = Prisma.CommentGetPayload<{
  select: typeof COMMENT_VIEW_SELECT;
}>;

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly abuse: AbuseRateLimiterService,
    private readonly writeAbuse: CommentWriteAbuseService,
    private readonly metrics: MetricsService,
  ) {}

  async createReply(input: {
    userId: string;
    parentCommentId: string;
    body: string;
    ipAddress?: string;
  }): Promise<CommentView> {
    const parentContext = await this.prisma.comment.findUnique({
      where: { id: input.parentCommentId },
      select: { storyId: true, chapterId: true },
    });
    if (!parentContext)
      throw new CommentNotFoundException(input.parentCommentId);

    const body = await this.writeAbuse.prepare({
      userId: input.userId,
      storyId: parentContext.storyId,
      chapterId: parentContext.chapterId,
      body: input.body,
      ipAddress: input.ipAddress,
    });

    const created = await this.prisma.$transaction(async (tx) => {
      const parent = await this.lockComment(tx, input.parentCommentId);
      if (!parent) throw new CommentNotFoundException(input.parentCommentId);
      if (parent.moderationStatus !== 'visible' || parent.deletedAt) {
        throw new CommentNotReplyableException();
      }

      let depth: 1 | 2;
      if (!parent.parentId) {
        depth = 1;
      } else {
        const ancestor = await tx.comment.findUnique({
          where: { id: parent.parentId },
          select: {
            id: true,
            parentId: true,
            moderationStatus: true,
            deletedAt: true,
          },
        });
        if (!ancestor || ancestor.parentId)
          throw new CommentReplyDepthExceededException();
        const ancestorKeepsThreadPublic =
          (ancestor.moderationStatus === ModerationStatus.VISIBLE &&
            ancestor.deletedAt === null) ||
          (ancestor.moderationStatus === ModerationStatus.DELETED &&
            ancestor.deletedAt !== null);
        if (!ancestorKeepsThreadPublic)
          throw new CommentNotReplyableException();
        depth = 2;
      }

      const row = await tx.comment.create({
        data: {
          userId: input.userId,
          storyId: parent.storyId,
          chapterId: parent.chapterId,
          parentId: parent.id,
          body,
          moderationStatus: ModerationStatus.VISIBLE,
        },
        select: COMMENT_VIEW_SELECT,
      });

      await tx.comment.update({
        where: { id: parent.id },
        data: { replyCount: { increment: 1 } },
      });
      await tx.story.update({
        where: { id: parent.storyId },
        data: { commentCount: { increment: 1 } },
      });
      if (parent.chapterId) {
        await tx.chapter.update({
          where: { id: parent.chapterId },
          data: { commentCount: { increment: 1 } },
        });
      }

      if (parent.userId !== input.userId) {
        const preference = await tx.notificationPreference.findUnique({
          where: { userId: parent.userId },
          select: { commentReplyEnabled: true },
        });
        if (preference?.commentReplyEnabled ?? true) {
          const story = await tx.story.findUnique({
            where: { id: parent.storyId },
            select: { slug: true },
          });
          const chapter = parent.chapterId
            ? await tx.chapter.findUnique({
                where: { id: parent.chapterId },
                select: { number: true },
              })
            : null;
          await tx.notification.create({
            data: {
              userId: parent.userId,
              type: 'comment',
              title: 'Có phản hồi mới',
              body: 'Có người vừa phản hồi bình luận của bạn.',
              data: {
                storyId: parent.storyId,
                storySlug: story?.slug ?? null,
                chapterId: parent.chapterId,
                chapterNumber: chapter ? Number(chapter.number) : null,
                commentId: parent.id,
                replyId: row.id,
              },
            },
          });
        }
      }

      return this.toView(
        row,
        depth,
        this.emptyReactionCounts(),
        row.replyCount,
      );
    });
    this.metrics.recordCommentOperation('reply');
    return created;
  }

  async listReplies(
    rootCommentId: string,
    page: number,
    pageSize: number,
  ): Promise<CommentPageView> {
    const boundedPage = Math.max(1, page);
    const boundedSize = Math.min(50, Math.max(1, pageSize));
    const root = await this.prisma.comment.findUnique({
      where: { id: rootCommentId },
      select: {
        id: true,
        parentId: true,
        moderationStatus: true,
        deletedAt: true,
      },
    });
    if (!root || root.parentId)
      throw new CommentNotFoundException(rootCommentId);
    if (
      (
        [
          ModerationStatus.PENDING,
          ModerationStatus.HIDDEN,
          ModerationStatus.REMOVED,
        ] as readonly ModerationStatus[]
      ).includes(root.moderationStatus)
    ) {
      throw new CommentNotFoundException(rootCommentId);
    }

    const visibleOrTombstone: Prisma.CommentWhereInput = {
      OR: [
        { moderationStatus: ModerationStatus.VISIBLE, deletedAt: null },
        {
          moderationStatus: ModerationStatus.DELETED,
          deletedAt: { not: null },
          replies: {
            some: {
              moderationStatus: ModerationStatus.VISIBLE,
              deletedAt: null,
            },
          },
        },
      ],
    };
    const where: Prisma.CommentWhereInput = {
      AND: [
        {
          OR: [
            { parentId: rootCommentId },
            {
              parent: {
                parentId: rootCommentId,
                moderationStatus: {
                  in: [ModerationStatus.VISIBLE, ModerationStatus.DELETED],
                },
              },
            },
          ],
        },
        visibleOrTombstone,
      ],
    };
    const skip = (boundedPage - 1) * boundedSize;
    const [totalItems, rows] = await this.prisma.$transaction([
      this.prisma.comment.count({ where }),
      this.prisma.comment.findMany({
        where,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip,
        take: boundedSize,
        select: COMMENT_VIEW_SELECT,
      }),
    ]);
    const reactionCounts = await this.aggregateReactions(
      rows.map((row) => row.id),
    );
    const threadCounts = await this.countThreadReplies(
      rows.map((row) => row.id),
    );
    return {
      items: rows.map((row) =>
        this.toView(
          row,
          row.parent?.parentId ? 2 : 1,
          reactionCounts.get(row.id) ?? this.emptyReactionCounts(),
          threadCounts.get(row.id) ?? row.replyCount,
        ),
      ),
      pagination: {
        page: boundedPage,
        pageSize: boundedSize,
        totalItems,
        totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / boundedSize),
      },
    };
  }

  async setReaction(input: {
    userId: string;
    commentId: string;
    type: ReactionName;
    ipAddress?: string;
  }): Promise<ReactionSummaryView> {
    await this.abuse.consume('reaction', input.userId, input.ipAddress);
    const type = this.toReactionType(input.type);
    await this.prisma.$transaction(async (tx) => {
      const comment = await this.lockComment(tx, input.commentId);
      if (!comment) throw new CommentNotFoundException(input.commentId);
      if (
        comment.moderationStatus !== 'visible' ||
        comment.deletedAt ||
        !(await this.areAncestorsPublic(tx, comment.id))
      )
        throw new CommentNotReactableException();

      const current = await tx.commentReaction.findUnique({
        where: {
          commentId_userId: {
            commentId: input.commentId,
            userId: input.userId,
          },
        },
        select: { type: true },
      });
      if (current?.type === type) return;
      if (current) {
        await tx.commentReaction.update({
          where: {
            commentId_userId: {
              commentId: input.commentId,
              userId: input.userId,
            },
          },
          data: { type },
        });
      } else {
        await tx.commentReaction.create({
          data: { commentId: input.commentId, userId: input.userId, type },
        });
      }
      const delta =
        (type === ReactionType.LIKE ? 1 : 0) -
        (current?.type === ReactionType.LIKE ? 1 : 0);
      if (delta > 0) {
        await tx.comment.update({
          where: { id: input.commentId },
          data: { likeCount: { increment: delta } },
        });
      } else if (delta < 0) {
        await tx.$executeRaw(Prisma.sql`
          UPDATE "comments" SET "like_count" = GREATEST("like_count" - 1, 0)
          WHERE "id" = ${input.commentId}::uuid
        `);
      }
    });
    this.metrics.recordCommentReaction('set', input.type);
    return this.reactionSummary(input.commentId, input.userId);
  }

  async clearReaction(input: {
    userId: string;
    commentId: string;
    ipAddress?: string;
  }): Promise<void> {
    await this.abuse.consume('reaction', input.userId, input.ipAddress);
    await this.prisma.$transaction(async (tx) => {
      const comment = await this.lockComment(tx, input.commentId);
      if (!comment) throw new CommentNotFoundException(input.commentId);
      if (
        comment.moderationStatus !== 'visible' ||
        comment.deletedAt ||
        !(await this.areAncestorsPublic(tx, comment.id))
      )
        throw new CommentNotReactableException();
      const current = await tx.commentReaction.findUnique({
        where: {
          commentId_userId: {
            commentId: input.commentId,
            userId: input.userId,
          },
        },
        select: { type: true },
      });
      if (!current) return;
      await tx.commentReaction.delete({
        where: {
          commentId_userId: {
            commentId: input.commentId,
            userId: input.userId,
          },
        },
      });
      if (current.type === ReactionType.LIKE) {
        await tx.$executeRaw(Prisma.sql`
          UPDATE "comments" SET "like_count" = GREATEST("like_count" - 1, 0)
          WHERE "id" = ${input.commentId}::uuid
        `);
      }
    });
    this.metrics.recordCommentReaction('remove', 'none');
  }

  async viewerReactions(
    userId: string,
    commentIds: readonly string[],
  ): Promise<Record<string, ReactionName | null>> {
    const ids = [...new Set(commentIds)].slice(0, 51);
    if (ids.length > 50)
      throw new InvalidReportException(
        'Chỉ được truy vấn tối đa 50 bình luận mỗi lần',
      );
    const result: Record<string, ReactionName | null> = Object.fromEntries(
      ids.map((id) => [id, null]),
    );
    if (ids.length === 0) return result;
    const rows = await this.prisma.commentReaction.findMany({
      where: { userId, commentId: { in: ids } },
      select: { commentId: true, type: true },
    });
    for (const row of rows) result[row.commentId] = row.type;
    return result;
  }

  async createReport(input: {
    userId: string;
    commentId: string;
    reason: ReportReasonName;
    description?: string;
    ipAddress?: string;
  }): Promise<CommentReportView> {
    await this.abuse.consume('report', input.userId, input.ipAddress);
    const reason = this.toReportReason(input.reason);
    const description = CommentPolicy.normalizeReportDescription(
      input.reason,
      input.description,
    );
    try {
      const report = await this.prisma.$transaction(async (tx) => {
        const comment = await this.lockComment(tx, input.commentId);
        if (!comment) throw new CommentNotFoundException(input.commentId);
        if (comment.userId === input.userId)
          throw new CommentSelfReportNotAllowedException();
        if (
          comment.moderationStatus !== 'visible' ||
          comment.deletedAt ||
          !(await this.areAncestorsPublic(tx, comment.id))
        )
          throw new CommentNotReportableException();
        const current = await tx.comment.findUnique({
          where: { id: input.commentId },
          select: {
            id: true,
            body: true,
            userId: true,
            storyId: true,
            chapterId: true,
            createdAt: true,
            editedAt: true,
            moderationStatus: true,
          },
        });
        if (!current) throw new CommentNotFoundException(input.commentId);
        return tx.report.create({
          data: {
            reporterId: input.userId,
            targetType: ReportTargetType.COMMENT,
            commentId: current.id,
            reason,
            description,
            evidence: {
              comment: {
                id: current.id,
                body: current.body,
                authorId: current.userId,
                createdAt: current.createdAt.toISOString(),
                editedAt: current.editedAt?.toISOString() ?? null,
                moderationStatus: current.moderationStatus,
              },
              context: {
                storyId: current.storyId,
                chapterId: current.chapterId,
              },
            },
          },
          select: { id: true, status: true, reason: true, createdAt: true },
        });
      });
      this.metrics.recordCommentReport(input.reason);
      return {
        id: report.id,
        status: report.status,
        reason: report.reason,
        createdAt: report.createdAt.toISOString(),
      };
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ReportAlreadyOpenException();
      throw error;
    }
  }

  private async reactionSummary(
    commentId: string,
    userId: string,
  ): Promise<ReactionSummaryView> {
    const groups = await this.prisma.commentReaction.groupBy({
      by: ['type'],
      where: { commentId },
      _count: { _all: true },
    });
    const current = await this.prisma.commentReaction.findUnique({
      where: { commentId_userId: { commentId, userId } },
      select: { type: true },
    });
    const reactions = this.emptyReactionCounts();
    for (const group of groups) reactions[group.type] = group._count._all;
    return {
      commentId,
      viewerReaction: current?.type ?? null,
      reactions,
      total: Object.values(reactions).reduce((sum, count) => sum + count, 0),
    };
  }

  private async aggregateReactions(
    ids: readonly string[],
  ): Promise<Map<string, Record<ReactionName, number>>> {
    if (ids.length === 0) return new Map();
    const rows = await this.prisma.commentReaction.groupBy({
      by: ['commentId', 'type'],
      where: { commentId: { in: [...ids] } },
      _count: { _all: true },
    });
    const result = new Map<string, Record<ReactionName, number>>();
    for (const row of rows) {
      const counts = result.get(row.commentId) ?? this.emptyReactionCounts();
      counts[row.type] = row._count._all;
      result.set(row.commentId, counts);
    }
    return result;
  }

  private async countThreadReplies(
    ids: readonly string[],
  ): Promise<Map<string, number>> {
    if (ids.length === 0) return new Map();
    const rows = await this.prisma.comment.groupBy({
      by: ['parentId'],
      where: {
        parentId: { in: [...ids] },
        moderationStatus: ModerationStatus.VISIBLE,
        deletedAt: null,
      },
      _count: { _all: true },
    });
    return new Map(
      rows
        .filter((row) => row.parentId)
        .map((row) => [row.parentId!, row._count._all]),
    );
  }

  private toView(
    row: CommentViewRow,
    depth: 0 | 1 | 2,
    reactions: Record<ReactionName, number>,
    threadReplyCount: number,
  ): CommentView {
    const deleted =
      row.moderationStatus === ModerationStatus.DELETED ||
      row.deletedAt !== null;
    const avatar = row.user.avatarMedia;
    const avatarUrl =
      avatar &&
      avatar.deletedAt === null &&
      avatar.purpose === MediaPurpose.AVATAR &&
      avatar.status === MediaStatus.READY &&
      avatar.resourceType === MediaResourceType.IMAGE
        ? (avatar.secureUrl ?? avatar.publicUrl)
        : null;
    return {
      id: row.id,
      storyId: row.storyId,
      chapterId: row.chapterId,
      parentId: row.parentId,
      depth,
      body: deleted ? '' : row.body,
      displayState: deleted ? 'DELETED' : 'VISIBLE',
      user: { id: row.user.id, displayName: row.user.displayName, avatarUrl },
      likeCount: row.likeCount,
      reactions,
      replyCount: row.replyCount,
      threadReplyCount,
      editedAt: row.editedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
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

  private async lockComment(
    tx: Prisma.TransactionClient,
    commentId: string,
  ): Promise<{
    id: string;
    storyId: string;
    chapterId: string | null;
    userId: string;
    parentId: string | null;
    moderationStatus: string;
    deletedAt: Date | null;
  } | null> {
    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        storyId: string;
        chapterId: string | null;
        userId: string;
        parentId: string | null;
        moderationStatus: string;
        deletedAt: Date | null;
      }>
    >(Prisma.sql`
      SELECT "id", "story_id" AS "storyId", "chapter_id" AS "chapterId", "user_id" AS "userId",
             "parent_id" AS "parentId", "moderation_status"::text AS "moderationStatus", "deleted_at" AS "deletedAt"
      FROM "comments" WHERE "id" = ${commentId}::uuid FOR UPDATE
    `);
    return rows[0] ?? null;
  }

  private toReactionType(value: ReactionName): ReactionType {
    if (!REACTION_NAMES.includes(value))
      throw new InvalidReportException('Loại cảm xúc không hợp lệ');
    return ReactionType[value];
  }

  private toReportReason(value: ReportReasonName): ReportReason {
    if (!(value in ReportReason))
      throw new InvalidReportException('Lý do báo cáo không hợp lệ');
    return ReportReason[value];
  }

  private emptyReactionCounts(): Record<ReactionName, number> {
    return { LIKE: 0, LOVE: 0, LAUGH: 0, INSIGHTFUL: 0 };
  }
}
