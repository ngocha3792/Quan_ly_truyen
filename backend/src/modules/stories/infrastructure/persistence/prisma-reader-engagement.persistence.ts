import { Injectable } from '@nestjs/common';

import {
  ChapterStatus,
  LibraryStatus,
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
  LibraryEntryResultDto,
  ListCommentsInput,
  ListCommentsResult,
  ReaderEngagementPersistencePort,
  ReaderStorySummaryDto,
  ReadingHistoryEntryResultDto,
  SaveReadingProgressInput,
  SaveReadingProgressResult,
  StoryCommentResultDto,
  StoryRatingResultDto,
  UpdateStoryCommentInput,
  UpdateStoryCommentResult,
  UpsertLibraryEntryInput,
  UpsertLibraryEntryResult,
  UpsertStoryRatingInput,
  UpsertStoryRatingResult,
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

const READER_STORY_SELECT = {
  id: true,
  slug: true,
  title: true,
  chapterCount: true,
  author: {
    select: {
      penName: true,
    },
  },
  coverMedia: {
    select: {
      purpose: true,
      status: true,
      resourceType: true,
      secureUrl: true,
      publicUrl: true,
      deletedAt: true,
    },
  },
  categories: {
    where: {
      category: { isActive: true },
    },
    select: {
      category: {
        select: { name: true },
      },
    },
  },
  chapters: {
    where: {
      status: ChapterStatus.PUBLISHED,
      deletedAt: null,
      publishedAt: { not: null },
    },
    orderBy: [{ number: 'desc' as const }, { id: 'desc' as const }],
    take: 1,
    select: { number: true },
  },
} satisfies Prisma.StorySelect;

type ReaderStoryRow = Prisma.StoryGetPayload<{
  select: typeof READER_STORY_SELECT;
}>;

const LIBRARY_ENTRY_SELECT = {
  status: true,
  isFavorite: true,
  progressPercent: true,
  startedAt: true,
  completedAt: true,
  updatedAt: true,
  lastReadChapter: {
    select: {
      id: true,
      number: true,
      title: true,
    },
  },
  story: {
    select: READER_STORY_SELECT,
  },
} satisfies Prisma.LibraryEntrySelect;

type LibraryEntryRow = Prisma.LibraryEntryGetPayload<{
  select: typeof LIBRARY_ENTRY_SELECT;
}>;

const READING_HISTORY_SELECT = {
  position: true,
  progressPercent: true,
  lastReadAt: true,
  currentChapter: {
    select: {
      id: true,
      number: true,
      title: true,
    },
  },
  story: {
    select: READER_STORY_SELECT,
  },
} satisfies Prisma.ReadingProgressSelect;

type ReadingHistoryRow = Prisma.ReadingProgressGetPayload<{
  select: typeof READING_HISTORY_SELECT;
}>;

const COMMENT_SELECT = {
  id: true,
  storyId: true,
  chapterId: true,
  parentId: true,
  body: true,
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

  async listLibrary(userId: string): Promise<readonly LibraryEntryResultDto[]> {
    try {
      const rows = await this.prisma.libraryEntry.findMany({
        where: {
          userId,
          story: PUBLIC_STORY_WHERE,
        },
        orderBy: [{ updatedAt: 'desc' }, { storyId: 'asc' }],
        select: LIBRARY_ENTRY_SELECT,
      });

      return rows.map(toLibraryEntryDto);
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'library-list-own',
        resource: 'Thư viện',
      });
    }
  }

  async upsertLibraryEntry(
    input: UpsertLibraryEntryInput,
  ): Promise<UpsertLibraryEntryResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await lockLibraryEngagement(tx, input.userId, input.storyId);

        const story = await tx.story.findFirst({
          where: { id: input.storyId, ...PUBLIC_STORY_WHERE },
          select: { id: true },
        });
        if (!story) return { status: 'story_not_found' as const };

        const current = await tx.libraryEntry.findUnique({
          where: {
            userId_storyId: { userId: input.userId, storyId: input.storyId },
          },
          select: {
            status: true,
            isFavorite: true,
            startedAt: true,
            completedAt: true,
          },
        });

        const status = toLibraryStatus(
          input.status ?? current?.status ?? 'PLAN_TO_READ',
        );
        const startedAt =
          status === LibraryStatus.READING && !current?.startedAt
            ? input.updatedAt
            : (current?.startedAt ?? null);
        const completedAt =
          status === LibraryStatus.COMPLETED
            ? (current?.completedAt ?? input.updatedAt)
            : null;

        const entry = await tx.libraryEntry.upsert({
          where: {
            userId_storyId: { userId: input.userId, storyId: input.storyId },
          },
          create: {
            userId: input.userId,
            storyId: input.storyId,
            status,
            isFavorite: input.isFavorite ?? false,
            startedAt,
            completedAt,
            updatedAt: input.updatedAt,
          },
          update: {
            ...(input.status !== undefined
              ? { status, startedAt, completedAt }
              : {}),
            ...(input.isFavorite !== undefined
              ? { isFavorite: input.isFavorite }
              : {}),
            updatedAt: input.updatedAt,
          },
          select: LIBRARY_ENTRY_SELECT,
        });

        return { status: 'updated' as const, entry: toLibraryEntryDto(entry) };
      });
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'library-upsert-own',
        resource: 'Thư viện',
      });
    }
  }

  async removeLibraryEntry(userId: string, storyId: string): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await lockLibraryEngagement(tx, userId, storyId);
        await tx.libraryEntry.deleteMany({ where: { userId, storyId } });
      });
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'library-remove-own',
        resource: 'Thư viện',
      });
    }
  }

  async listReadingHistory(
    userId: string,
  ): Promise<readonly ReadingHistoryEntryResultDto[]> {
    try {
      const rows = await this.prisma.readingProgress.findMany({
        where: {
          userId,
          story: PUBLIC_STORY_WHERE,
        },
        orderBy: [{ lastReadAt: 'desc' }, { storyId: 'asc' }],
        select: READING_HISTORY_SELECT,
      });
      return rows.map(toReadingHistoryDto);
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'reading-history-list-own',
        resource: 'Lịch sử đọc',
      });
    }
  }

  async saveReadingProgress(
    input: SaveReadingProgressInput,
  ): Promise<SaveReadingProgressResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await lockLibraryEngagement(tx, input.userId, input.storyId);

        const story = await tx.story.findFirst({
          where: { id: input.storyId, ...PUBLIC_STORY_WHERE },
          select: { id: true },
        });
        if (!story) return { status: 'story_not_found' as const };

        const chapter = await tx.chapter.findFirst({
          where: {
            id: input.chapterId,
            storyId: input.storyId,
            status: ChapterStatus.PUBLISHED,
            deletedAt: null,
            publishedAt: { not: null },
          },
          select: { id: true, number: true },
        });
        if (!chapter) return { status: 'chapter_not_found' as const };

        const totalChapters = await tx.chapter.count({
          where: {
            storyId: input.storyId,
            status: ChapterStatus.PUBLISHED,
            deletedAt: null,
            publishedAt: { not: null },
          },
        });
        const readThrough = await tx.chapter.count({
          where: {
            storyId: input.storyId,
            status: ChapterStatus.PUBLISHED,
            deletedAt: null,
            publishedAt: { not: null },
            number: { lte: chapter.number },
          },
        });
        const computedPercent =
          totalChapters > 0
            ? Math.min(
                100,
                Math.round((readThrough / totalChapters) * 10000) / 100,
              )
            : 0;

        await tx.libraryEntry.upsert({
          where: {
            userId_storyId: { userId: input.userId, storyId: input.storyId },
          },
          create: {
            userId: input.userId,
            storyId: input.storyId,
            status:
              computedPercent >= 100
                ? LibraryStatus.COMPLETED
                : LibraryStatus.READING,
            lastReadChapterId: chapter.id,
            progressPercent: computedPercent,
            startedAt: input.readAt,
            completedAt: computedPercent >= 100 ? input.readAt : null,
            updatedAt: input.readAt,
          },
          update: {
            updatedAt: input.readAt,
          },
        });

        const library = await tx.libraryEntry.findUnique({
          where: {
            userId_storyId: { userId: input.userId, storyId: input.storyId },
          },
          select: { startedAt: true, completedAt: true },
        });

        const existing = await tx.readingProgress.findUnique({
          where: {
            userId_storyId: { userId: input.userId, storyId: input.storyId },
          },
          select: {
            currentChapterId: true,
            position: true,
            progressPercent: true,
            lastReadAt: true,
            currentChapter: { select: { number: true } },
          },
        });

        const incomingChapterNumber = chapter.number.toNumber();
        const existingChapterNumber =
          existing?.currentChapter?.number.toNumber();
        const shouldAdvance =
          existingChapterNumber === undefined ||
          incomingChapterNumber >= existingChapterNumber;
        const shouldUseIncomingPosition =
          existingChapterNumber === undefined ||
          incomingChapterNumber > existingChapterNumber ||
          (incomingChapterNumber === existingChapterNumber &&
            (!existing?.lastReadAt || input.readAt >= existing.lastReadAt));
        const progressPercent = shouldAdvance
          ? Math.max(computedPercent, Number(existing?.progressPercent ?? 0))
          : Number(existing?.progressPercent ?? computedPercent);
        const currentChapterId = shouldAdvance
          ? chapter.id
          : (existing?.currentChapterId ?? chapter.id);
        const effectiveReadAt =
          existing?.lastReadAt && existing.lastReadAt > input.readAt
            ? existing.lastReadAt
            : input.readAt;
        const completedAt =
          progressPercent >= 100
            ? (library?.completedAt ?? effectiveReadAt)
            : null;

        await tx.readingProgress.upsert({
          where: {
            userId_storyId: { userId: input.userId, storyId: input.storyId },
          },
          create: {
            userId: input.userId,
            storyId: input.storyId,
            currentChapterId,
            position: input.position,
            progressPercent,
            lastReadAt: effectiveReadAt,
          },
          update: {
            currentChapterId,
            position: shouldUseIncomingPosition
              ? input.position
              : (existing?.position ?? input.position),
            progressPercent,
            lastReadAt: effectiveReadAt,
            updatedAt: effectiveReadAt,
          },
        });

        await tx.libraryEntry.update({
          where: {
            userId_storyId: { userId: input.userId, storyId: input.storyId },
          },
          data: {
            status:
              progressPercent >= 100
                ? LibraryStatus.COMPLETED
                : LibraryStatus.READING,
            lastReadChapterId: currentChapterId,
            progressPercent,
            startedAt: library?.startedAt ?? input.readAt,
            completedAt,
            updatedAt: effectiveReadAt,
          },
        });

        const saved = await tx.readingProgress.findUnique({
          where: {
            userId_storyId: { userId: input.userId, storyId: input.storyId },
          },
          select: READING_HISTORY_SELECT,
        });

        if (!saved) return { status: 'chapter_not_found' as const };
        return { status: 'saved' as const, entry: toReadingHistoryDto(saved) };
      });
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'reading-progress-save-own',
        resource: 'Tiến độ đọc',
      });
    }
  }

  async removeReadingHistoryEntry(
    userId: string,
    storyId: string,
  ): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await lockLibraryEngagement(tx, userId, storyId);
        await tx.readingProgress.deleteMany({ where: { userId, storyId } });
        await tx.libraryEntry.updateMany({
          where: { userId, storyId },
          data: {
            lastReadChapterId: null,
            progressPercent: 0,
            startedAt: null,
            completedAt: null,
          },
        });
      });
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'reading-history-remove-own',
        resource: 'Lịch sử đọc',
      });
    }
  }

  async clearReadingHistory(userId: string): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.readingProgress.deleteMany({ where: { userId } });
        await tx.libraryEntry.updateMany({
          where: { userId },
          data: {
            lastReadChapterId: null,
            progressPercent: 0,
            startedAt: null,
            completedAt: null,
          },
        });
      });
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'reading-history-clear-own',
        resource: 'Lịch sử đọc',
      });
    }
  }

  async findMyRating(
    userId: string,
    storyId: string,
  ): Promise<StoryRatingResultDto | null> {
    try {
      const rating = await this.prisma.rating.findFirst({
        where: {
          userId,
          storyId,
          deletedAt: null,
          moderationStatus: ModerationStatus.VISIBLE,
        },
        select: { storyId: true, score: true, updatedAt: true },
      });
      return rating ? toRatingDto(rating) : null;
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'rating-read-own',
        resource: 'Đánh giá',
      });
    }
  }

  async upsertRating(
    input: UpsertStoryRatingInput,
  ): Promise<UpsertStoryRatingResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (!(await lockPublicStory(tx, input.storyId))) {
          return { status: 'story_not_found' as const };
        }

        const rating = await tx.rating.upsert({
          where: {
            userId_storyId: { userId: input.userId, storyId: input.storyId },
          },
          create: {
            userId: input.userId,
            storyId: input.storyId,
            score: input.score,
            moderationStatus: ModerationStatus.VISIBLE,
            updatedAt: input.updatedAt,
          },
          update: {
            score: input.score,
            moderationStatus: ModerationStatus.VISIBLE,
            deletedAt: null,
            updatedAt: input.updatedAt,
          },
          select: { storyId: true, score: true, updatedAt: true },
        });

        await refreshRatingAggregate(tx, input.storyId);
        return { status: 'updated' as const, rating: toRatingDto(rating) };
      });
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'rating-upsert-own',
        resource: 'Đánh giá',
      });
    }
  }

  async deleteRating(userId: string, storyId: string): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        if (!(await lockStoryWithOwnedRating(tx, userId, storyId))) return;
        await tx.rating.updateMany({
          where: { userId, storyId, deletedAt: null },
          data: { deletedAt: new Date() },
        });
        await refreshRatingAggregate(tx, storyId);
      });
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'rating-delete-own',
        resource: 'Đánh giá',
      });
    }
  }

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
        moderationStatus: ModerationStatus.VISIBLE,
        deletedAt: null,
        user: { deletedAt: null },
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

      return {
        status: 'found',
        page: {
          items: rows.map(toCommentDto),
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

function toLibraryStatus(status: string): LibraryStatus {
  switch (status) {
    case 'READING':
      return LibraryStatus.READING;
    case 'COMPLETED':
      return LibraryStatus.COMPLETED;
    case 'ON_HOLD':
      return LibraryStatus.ON_HOLD;
    case 'DROPPED':
      return LibraryStatus.DROPPED;
    case 'PLAN_TO_READ':
    default:
      return LibraryStatus.PLAN_TO_READ;
  }
}

function toReaderStorySummary(row: ReaderStoryRow): ReaderStorySummaryDto {
  const cover = row.coverMedia;
  const coverUrl =
    cover &&
    cover.deletedAt === null &&
    cover.purpose === MediaPurpose.STORY_COVER &&
    cover.status === MediaStatus.READY &&
    cover.resourceType === MediaResourceType.IMAGE
      ? (cover.secureUrl ?? cover.publicUrl)
      : null;

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    author: row.author.penName,
    coverUrl,
    categories: row.categories.map(({ category }) => category.name),
    latestChapterNumber: row.chapters[0]
      ? Number(row.chapters[0].number)
      : null,
    chapterCount: row.chapterCount,
  };
}

function toLibraryEntryDto(row: LibraryEntryRow): LibraryEntryResultDto {
  return {
    story: toReaderStorySummary(row.story),
    status: row.status,
    isFavorite: row.isFavorite,
    lastReadChapter: row.lastReadChapter
      ? {
          id: row.lastReadChapter.id,
          number: Number(row.lastReadChapter.number),
          title: row.lastReadChapter.title,
        }
      : null,
    progressPercent: Number(row.progressPercent),
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toReadingHistoryDto(
  row: ReadingHistoryRow,
): ReadingHistoryEntryResultDto {
  return {
    story: toReaderStorySummary(row.story),
    currentChapter: row.currentChapter
      ? {
          id: row.currentChapter.id,
          number: Number(row.currentChapter.number),
          title: row.currentChapter.title,
        }
      : null,
    position: row.position,
    progressPercent: Number(row.progressPercent),
    lastReadAt: row.lastReadAt.toISOString(),
  };
}

function toRatingDto(row: {
  storyId: string;
  score: number;
  updatedAt: Date;
}): StoryRatingResultDto {
  return {
    storyId: row.storyId,
    score: row.score,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toCommentDto(row: CommentRow): StoryCommentResultDto {
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
    body: row.body,
    user: {
      id: row.user.id,
      displayName: row.user.displayName,
      avatarUrl,
    },
    likeCount: row.likeCount,
    replyCount: row.replyCount,
    editedAt: row.editedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function lockLibraryEngagement(
  tx: Prisma.TransactionClient,
  userId: string,
  storyId: string,
): Promise<void> {
  await tx.$executeRaw(Prisma.sql`
    SELECT pg_advisory_xact_lock(
      hashtext('library_engagement:' || ${userId} || ':' || ${storyId})
    )
  `);
}

async function lockPublicStory(
  tx: Prisma.TransactionClient,
  storyId: string,
): Promise<boolean> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "stories"
    WHERE "id" = ${storyId}::uuid
      AND "deleted_at" IS NULL
      AND "visibility" = 'public'
      AND "published_at" IS NOT NULL
      AND "status" IN ('published', 'hiatus', 'completed')
    FOR UPDATE
  `);
  return rows.length === 1;
}

async function lockStoryWithOwnedRating(
  tx: Prisma.TransactionClient,
  userId: string,
  storyId: string,
): Promise<boolean> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT s."id"
    FROM "stories" AS s
    WHERE s."id" = ${storyId}::uuid
      AND EXISTS (
        SELECT 1
        FROM "ratings" AS r
        WHERE r."story_id" = s."id"
          AND r."user_id" = ${userId}::uuid
          AND r."deleted_at" IS NULL
      )
    FOR UPDATE OF s
  `);
  return rows.length === 1;
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

async function refreshRatingAggregate(
  tx: Prisma.TransactionClient,
  storyId: string,
): Promise<void> {
  const aggregate = await tx.rating.aggregate({
    where: {
      storyId,
      deletedAt: null,
      moderationStatus: ModerationStatus.VISIBLE,
    },
    _count: { _all: true },
    _avg: { score: true },
  });
  await tx.story.updateMany({
    where: { id: storyId, deletedAt: null },
    data: {
      ratingCount: aggregate._count._all,
      ratingAverage: aggregate._avg.score ?? 0,
    },
  });
}

function parseChapterNumber(raw: string): Prisma.Decimal | null {
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(raw)) return null;
  try {
    return new Prisma.Decimal(raw);
  } catch {
    return null;
  }
}
