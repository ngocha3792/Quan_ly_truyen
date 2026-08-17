import { Injectable } from '@nestjs/common';

import {
  ChapterStatus,
  MediaPurpose,
  MediaResourceType,
  MediaStatus,
  ModerationStatus,
  Prisma,
  StoryStatus,
  StoryVisibility,
} from '@/generated/prisma/client';
import { mapPrismaError, PrismaService } from '@/infrastructure/database';

import type {
  CreateStoryCommentInput,
  CreateStoryCommentResult,
  DeleteStoryCommentInput,
  DeleteStoryCommentResult,
  ListCommentsInput,
  ListCommentsResult,
  ReaderEngagementPersistencePort,
  StoryCommentResultDto,
  UpdateStoryCommentInput,
  UpdateStoryCommentResult,
} from '../../application';

const PUBLIC_STORY_STATUSES = [
  StoryStatus.PUBLISHED,
  StoryStatus.HIATUS,
  StoryStatus.COMPLETED,
] as const;

const PUBLIC_STORY_WHERE = {
  deletedAt: null,
  visibility: StoryVisibility.PUBLIC,
  publishedAt: { not: null },
  status: { in: [...PUBLIC_STORY_STATUSES] },
} satisfies Prisma.StoryWhereInput;

const COMMENT_SELECT = {
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

type CommentRow = Prisma.CommentGetPayload<{ select: typeof COMMENT_SELECT }>;

@Injectable()
export class PrismaReaderEngagementPersistence implements ReaderEngagementPersistencePort {
  constructor(private readonly prisma: PrismaService) {}

  async listComments(input: ListCommentsInput): Promise<ListCommentsResult> {
    try {
      const story = await this.prisma.story.findFirst({
        where: { slug: input.storySlug, ...PUBLIC_STORY_WHERE },
        select: { id: true },
      });
      if (!story) return { status: 'story_not_found' };

      let chapterId: string | undefined;
      if (input.chapterNumber !== undefined) {
        const number = parseChapterNumber(input.chapterNumber);
        if (!number) return { status: 'chapter_not_found' };
        const chapter = await this.prisma.chapter.findFirst({
          where: {
            storyId: story.id,
            number,
            status: ChapterStatus.PUBLISHED,
            deletedAt: null,
            publishedAt: { not: null },
          },
          select: { id: true },
        });
        if (!chapter) return { status: 'chapter_not_found' };
        chapterId = chapter.id;
      }

      const where: Prisma.CommentWhereInput = {
        storyId: story.id,
        chapterId: chapterId ?? null,
        parentId: null,
        user: { deletedAt: null },
        OR: [
          { moderationStatus: ModerationStatus.VISIBLE, deletedAt: null },
          {
            moderationStatus: ModerationStatus.DELETED,
            deletedAt: { not: null },
            replies: {
              some: {
                OR: [
                  {
                    moderationStatus: ModerationStatus.VISIBLE,
                    deletedAt: null,
                  },
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
              },
            },
          },
        ],
      };
      const skip = (input.page - 1) * input.pageSize;
      const [totalItems, rows] = await this.prisma.$transaction([
        this.prisma.comment.count({ where }),
        this.prisma.comment.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip,
          take: input.pageSize,
          select: COMMENT_SELECT,
        }),
      ]);

      const reactionRows =
        rows.length === 0
          ? []
          : await this.prisma.commentReaction.groupBy({
              by: ['commentId', 'type'],
              where: { commentId: { in: rows.map((row) => row.id) } },
              _count: { _all: true },
            });
      const reactions = new Map<
        string,
        { LIKE: number; LOVE: number; LAUGH: number; INSIGHTFUL: number }
      >();
      for (const item of reactionRows) {
        const counts = reactions.get(item.commentId) ?? {
          LIKE: 0,
          LOVE: 0,
          LAUGH: 0,
          INSIGHTFUL: 0,
        };
        counts[item.type] = item._count._all;
        reactions.set(item.commentId, counts);
      }
      const threadCounts = await countVisibleThreadReplies(
        this.prisma,
        rows.map((row) => row.id),
      );

      return {
        status: 'found',
        page: {
          items: rows.map((row) =>
            toCommentDto(
              row,
              reactions.get(row.id) ?? {
                LIKE: 0,
                LOVE: 0,
                LAUGH: 0,
                INSIGHTFUL: 0,
              },
              threadCounts.get(row.id) ?? row.replyCount,
            ),
          ),
          pagination: {
            page: input.page,
            pageSize: input.pageSize,
            totalItems,
            totalPages:
              totalItems === 0 ? 0 : Math.ceil(totalItems / input.pageSize),
          },
        },
      };
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'comment-list-public',
        resource: 'Bình luận',
      });
    }
  }

  async createComment(
    input: CreateStoryCommentInput,
  ): Promise<CreateStoryCommentResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const story = await tx.story.findFirst({
          where: { id: input.storyId, ...PUBLIC_STORY_WHERE },
          select: { id: true },
        });
        if (!story) {
          return { status: 'story_not_found' as const };
        }

        if (input.chapterId) {
          const chapter = await tx.chapter.findFirst({
            where: {
              id: input.chapterId,
              storyId: input.storyId,
              status: ChapterStatus.PUBLISHED,
              deletedAt: null,
              publishedAt: { not: null },
            },
            select: { id: true },
          });
          if (!chapter) return { status: 'chapter_not_found' as const };
        }

        const comment = await tx.comment.create({
          data: {
            userId: input.userId,
            storyId: input.storyId,
            chapterId: input.chapterId,
            body: input.body,
            moderationStatus: ModerationStatus.VISIBLE,
            createdAt: input.createdAt,
            updatedAt: input.createdAt,
          },
          select: COMMENT_SELECT,
        });

        await tx.story.update({
          where: { id: input.storyId },
          data: { commentCount: { increment: 1 } },
        });
        if (input.chapterId) {
          await tx.chapter.update({
            where: { id: input.chapterId },
            data: { commentCount: { increment: 1 } },
          });
        }
        return { status: 'created' as const, comment: toCommentDto(comment) };
      });
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'comment-create',
        resource: 'Bình luận',
      });
    }
  }

  async updateComment(
    input: UpdateStoryCommentInput,
  ): Promise<UpdateStoryCommentResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (!(await lockOwnedComment(tx, input.commentId, input.userId))) {
          return { status: 'not_found' as const };
        }
        const comment = await tx.comment.update({
          where: { id: input.commentId },
          data: {
            body: input.body,
            editedAt: input.updatedAt,
            updatedAt: input.updatedAt,
          },
          select: COMMENT_SELECT,
        });
        return { status: 'updated' as const, comment: toCommentDto(comment) };
      });
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'comment-update-own',
        resource: 'Bình luận',
      });
    }
  }

  async deleteComment(
    input: DeleteStoryCommentInput,
  ): Promise<DeleteStoryCommentResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (!(await lockOwnedComment(tx, input.commentId, input.userId))) {
          return { status: 'not_found' as const };
        }
        const comment = await tx.comment.findFirst({
          where: { id: input.commentId, userId: input.userId, deletedAt: null },
          select: { id: true, storyId: true, chapterId: true, parentId: true },
        });
        if (!comment) return { status: 'not_found' as const };

        await tx.comment.update({
          where: { id: comment.id },
          data: {
            deletedAt: input.deletedAt,
            moderationStatus: ModerationStatus.DELETED,
            updatedAt: input.deletedAt,
          },
        });
        await tx.$executeRaw(Prisma.sql`
          UPDATE "stories"
          SET "comment_count" = GREATEST("comment_count" - 1, 0)
          WHERE "id" = ${comment.storyId}::uuid
        `);
        if (comment.chapterId) {
          await tx.$executeRaw(Prisma.sql`
            UPDATE "chapters"
            SET "comment_count" = GREATEST("comment_count" - 1, 0)
            WHERE "id" = ${comment.chapterId}::uuid
          `);
        }
        if (comment.parentId) {
          await tx.comment.updateMany({
            where: { id: comment.parentId, replyCount: { gt: 0 } },
            data: { replyCount: { decrement: 1 } },
          });
        }
        return { status: 'deleted' as const };
      });
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'comment-delete-own',
        resource: 'Bình luận',
      });
    }
  }
}

function toCommentDto(
  row: CommentRow,
  reactions: {
    LIKE: number;
    LOVE: number;
    LAUGH: number;
    INSIGHTFUL: number;
  } = { LIKE: 0, LOVE: 0, LAUGH: 0, INSIGHTFUL: 0 },
  threadReplyCount = row.replyCount,
): StoryCommentResultDto {
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
    depth: 0,
    body:
      row.moderationStatus === ModerationStatus.DELETED || row.deletedAt
        ? ''
        : row.body,
    displayState:
      row.moderationStatus === ModerationStatus.DELETED || row.deletedAt
        ? 'DELETED'
        : 'VISIBLE',
    user: {
      id: row.user.id,
      displayName: row.user.displayName,
      avatarUrl,
    },
    likeCount: row.likeCount,
    reactions,
    replyCount: row.replyCount,
    threadReplyCount,
    editedAt: row.editedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function lockOwnedComment(
  tx: Prisma.TransactionClient,
  commentId: string,
  userId: string,
): Promise<boolean> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "comments"
    WHERE "id" = ${commentId}::uuid
      AND "user_id" = ${userId}::uuid
      AND "deleted_at" IS NULL
      AND "moderation_status" = 'visible'
    FOR UPDATE
  `);
  return rows.length === 1;
}

async function countVisibleThreadReplies(
  prisma: PrismaService,
  rootIds: readonly string[],
): Promise<Map<string, number>> {
  if (rootIds.length === 0) return new Map();
  const rows = await prisma.$queryRaw<
    Array<{ rootId: string; count: bigint }>
  >(Prisma.sql`
    SELECT roots."id" AS "rootId", COUNT(descendants."id")::bigint AS "count"
    FROM "comments" roots
    LEFT JOIN "comments" direct
      ON direct."parent_id" = roots."id"
      AND (
        (direct."moderation_status" = 'visible'::"moderation_status" AND direct."deleted_at" IS NULL)
        OR (direct."moderation_status" = 'deleted'::"moderation_status" AND direct."deleted_at" IS NOT NULL)
      )
    LEFT JOIN "comments" descendants
      ON (descendants."id" = direct."id" OR descendants."parent_id" = direct."id")
      AND descendants."moderation_status" = 'visible'
      AND descendants."deleted_at" IS NULL
    WHERE roots."id" IN (${Prisma.join(rootIds.map((id) => Prisma.sql`${id}::uuid`))})
    GROUP BY roots."id"
  `);
  return new Map(rows.map((row) => [row.rootId, Number(row.count)]));
}

function parseChapterNumber(raw: string): Prisma.Decimal | null {
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(raw)) return null;
  try {
    return new Prisma.Decimal(raw);
  } catch {
    return null;
  }
}
