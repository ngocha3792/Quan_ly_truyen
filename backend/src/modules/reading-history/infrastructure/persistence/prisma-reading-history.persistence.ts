import { Injectable } from '@nestjs/common';

import {
  ChapterStatus,
  LibraryStatus,
  MediaPurpose,
  MediaResourceType,
  MediaStatus,
  Prisma,
  StoryStatus,
  StoryVisibility,
} from '@/generated/prisma/client';
import { mapPrismaError, PrismaService } from '@/infrastructure/database';

import type {
  ReadingHistoryEntryResultDto,
  ReadingHistoryPersistencePort,
  ReadingHistoryStorySummaryDto,
  SaveReadingProgressInput,
  SaveReadingProgressResult,
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

const READING_HISTORY_STORY_SELECT = {
  id: true,
  slug: true,
  title: true,
  chapterCount: true,
  author: { select: { penName: true } },
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
    where: { category: { isActive: true } },
    select: { category: { select: { name: true } } },
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

type ReadingHistoryStoryRow = Prisma.StoryGetPayload<{
  select: typeof READING_HISTORY_STORY_SELECT;
}>;

const READING_HISTORY_SELECT = {
  position: true,
  progressPercent: true,
  lastReadAt: true,
  currentChapter: {
    select: { id: true, number: true, title: true },
  },
  story: { select: READING_HISTORY_STORY_SELECT },
} satisfies Prisma.ReadingProgressSelect;

type ReadingHistoryRow = Prisma.ReadingProgressGetPayload<{
  select: typeof READING_HISTORY_SELECT;
}>;

@Injectable()
export class PrismaReadingHistoryPersistence implements ReadingHistoryPersistencePort {
  constructor(private readonly prisma: PrismaService) {}

  async listMine(
    userId: string,
  ): Promise<readonly ReadingHistoryEntryResultDto[]> {
    try {
      const rows = await this.prisma.readingProgress.findMany({
        where: { userId, story: PUBLIC_STORY_WHERE },
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

  async saveProgress(
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
          update: { updatedAt: input.readAt },
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
        const existingChapterNumber = existing?.currentChapter?.number.toNumber();
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

  async removeMine(userId: string, storyId: string): Promise<void> {
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

  async clearMine(userId: string): Promise<void> {
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
}

function toReadingHistoryStorySummary(
  row: ReadingHistoryStoryRow,
): ReadingHistoryStorySummaryDto {
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

function toReadingHistoryDto(
  row: ReadingHistoryRow,
): ReadingHistoryEntryResultDto {
  return {
    story: toReadingHistoryStorySummary(row.story),
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
