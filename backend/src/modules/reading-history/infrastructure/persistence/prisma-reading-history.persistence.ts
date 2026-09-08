import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AnalyticsConfig, ReaderFeaturesConfig } from '@/config';
import {
  ChapterStatus,
  LibraryStatus,
  MediaPurpose,
  MediaResourceType,
  MediaStatus,
  Prisma,
  ReadingCursorType,
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
  WeeklyReadingStatsResultDto,
} from '../../application';
import {
  buildWeeklyReadingStats,
  dateKeyInTimeZone,
  decideReadingProgressSync,
} from '../../domain/policies';
import { parseReadingCursor, type ReadingCursor } from '../../domain';

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
  cursor: true,
  cursorSchemaVersion: true,
  revision: true,
  deviceId: true,
  clientEventId: true,
  lastServerSequence: true,
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

interface ReadingActivityDayRow {
  readonly date: string;
  readonly readingSeconds: bigint;
  readonly chaptersCompleted: number;
}

@Injectable()
export class PrismaReadingHistoryPersistence implements ReadingHistoryPersistencePort {
  private readonly timeZone: string;
  private readonly portableCursorEnabled: boolean;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.timeZone = config.getOrThrow<AnalyticsConfig>('analytics').timeZone;
    this.portableCursorEnabled =
      config.get<ReaderFeaturesConfig>('readerFeatures')
        ?.portableCursorEnabled ?? false;
  }

  async listMine(
    userId: string,
  ): Promise<readonly ReadingHistoryEntryResultDto[]> {
    try {
      const rows = await this.prisma.readingProgress.findMany({
        where: { userId, story: PUBLIC_STORY_WHERE },
        orderBy: [{ lastReadAt: 'desc' }, { storyId: 'asc' }],
        select: READING_HISTORY_SELECT,
      });

      return rows.map((row) =>
        toReadingHistoryDto(row, this.portableCursorEnabled),
      );
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'reading-history-list-own',
        resource: 'Lịch sử đọc',
      });
    }
  }

  async getProgress(
    userId: string,
    storyId: string,
  ): Promise<ReadingHistoryEntryResultDto | null> {
    try {
      const row = await this.prisma.readingProgress.findFirst({
        where: { userId, storyId, story: PUBLIC_STORY_WHERE },
        select: READING_HISTORY_SELECT,
      });

      return row ? toReadingHistoryDto(row, this.portableCursorEnabled) : null;
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'reading-progress-get-own',
        resource: 'Tiến độ đọc',
      });
    }
  }

  async getWeeklyStats(userId: string): Promise<WeeklyReadingStatsResultDto> {
    try {
      const rows = await this.prisma.$queryRaw<ReadingActivityDayRow[]>(
        Prisma.sql`
          SELECT
            TO_CHAR(
              (COALESCE("ended_at", "started_at") AT TIME ZONE ${this.timeZone})::date,
              'YYYY-MM-DD'
            ) AS "date",
            SUM(COALESCE("duration_seconds", 0))::bigint AS "readingSeconds",
            COUNT(DISTINCT "chapter_id") FILTER (WHERE "completed")::integer
              AS "chaptersCompleted"
          FROM "reading_sessions"
          WHERE "user_id" = ${userId}::uuid
            AND (COALESCE("duration_seconds", 0) > 0 OR "completed")
          GROUP BY 1
          ORDER BY 1 ASC
        `,
      );

      return buildWeeklyReadingStats(
        rows.map((row) => ({
          date: row.date,
          readingSeconds: Number(row.readingSeconds),
          chaptersCompleted: row.chaptersCompleted,
        })),
        dateKeyInTimeZone(new Date(), this.timeZone),
        this.timeZone,
      );
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'weekly-reading-stats-get-own',
        resource: 'Thống kê đọc hàng tuần',
      });
    }
  }

  async saveProgress(
    input: SaveReadingProgressInput,
  ): Promise<SaveReadingProgressResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (input.sync) {
          await lockReadingProgressClientEvent(
            tx,
            input.userId,
            input.sync.clientEventId,
          );
        }
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

        const existing = await tx.readingProgress.findUnique({
          where: {
            userId_storyId: { userId: input.userId, storyId: input.storyId },
          },
          select: {
            currentChapterId: true,
            position: true,
            cursor: true,
            cursorSchemaVersion: true,
            cursorType: true,
            blockId: true,
            characterOffset: true,
            mediaAssetId: true,
            sliceId: true,
            relativeY: true,
            revision: true,
            deviceId: true,
            clientEventId: true,
            lastServerSequence: true,
            progressPercent: true,
            lastReadAt: true,
            currentChapter: { select: { number: true } },
          },
        });

        if (input.sync) {
          const duplicate = await tx.readingProgressSyncEvent.findUnique({
            where: {
              userId_clientEventId: {
                userId: input.userId,
                clientEventId: input.sync.clientEventId,
              },
            },
            select: { storyId: true },
          });
          const actualRevision = existing?.revision ?? 0;
          const decision = decideReadingProgressSync({
            storyId: input.storyId,
            baseRevision: input.sync.baseRevision,
            actualRevision,
            processedStoryId: duplicate?.storyId ?? null,
          });
          if (decision.kind === 'duplicate') {
            const entry = await findProgressEntry(
              tx,
              input.userId,
              input.storyId,
              this.portableCursorEnabled,
            );
            if (entry) {
              return { status: 'duplicate' as const, entry };
            }
            return {
              status: 'revision_conflict' as const,
              expectedRevision: input.sync.baseRevision,
              actualRevision,
              entry: null,
            };
          }
          if (decision.kind !== 'accept') {
            return {
              status: 'revision_conflict' as const,
              expectedRevision: decision.expectedRevision,
              actualRevision: decision.actualRevision,
              entry: await findProgressEntry(
                tx,
                input.userId,
                input.storyId,
                this.portableCursorEnabled,
              ),
            };
          }
        }

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
        const nextRevision = (existing?.revision ?? 0) + 1;
        const syncEvent = input.sync
          ? await tx.readingProgressSyncEvent.create({
              data: {
                userId: input.userId,
                storyId: input.storyId,
                clientEventId: input.sync.clientEventId,
                deviceId: input.sync.deviceId,
                baseRevision: input.sync.baseRevision,
                appliedRevision: nextRevision,
              },
              select: { serverSequence: true },
            })
          : null;
        const nextServerSequence =
          syncEvent?.serverSequence ?? existing?.lastServerSequence ?? 0n;
        const nextCursorColumns = toCursorColumns(input.cursor);

        await tx.readingProgress.upsert({
          where: {
            userId_storyId: { userId: input.userId, storyId: input.storyId },
          },
          create: {
            userId: input.userId,
            storyId: input.storyId,
            currentChapterId,
            position: input.position,
            cursor: input.cursor ? toPrismaJson(input.cursor) : undefined,
            cursorSchemaVersion: input.cursor?.schemaVersion,
            ...nextCursorColumns,
            revision: nextRevision,
            deviceId: input.sync?.deviceId,
            clientEventId: input.sync?.clientEventId,
            lastServerSequence: nextServerSequence,
            progressPercent,
            lastReadAt: effectiveReadAt,
          },
          update: {
            currentChapterId,
            position: shouldUseIncomingPosition
              ? input.position
              : (existing?.position ?? input.position),
            cursor:
              shouldUseIncomingPosition && input.cursor
                ? toPrismaJson(input.cursor)
                : (existing?.cursor ?? Prisma.DbNull),
            cursorSchemaVersion:
              shouldUseIncomingPosition && input.cursor
                ? input.cursor.schemaVersion
                : (existing?.cursorSchemaVersion ?? null),
            cursorType:
              shouldUseIncomingPosition && input.cursor
                ? nextCursorColumns.cursorType
                : existing?.cursorType,
            blockId:
              shouldUseIncomingPosition && input.cursor
                ? nextCursorColumns.blockId
                : existing?.blockId,
            characterOffset:
              shouldUseIncomingPosition && input.cursor
                ? nextCursorColumns.characterOffset
                : existing?.characterOffset,
            mediaAssetId:
              shouldUseIncomingPosition && input.cursor
                ? nextCursorColumns.mediaAssetId
                : existing?.mediaAssetId,
            sliceId:
              shouldUseIncomingPosition && input.cursor
                ? nextCursorColumns.sliceId
                : existing?.sliceId,
            relativeY:
              shouldUseIncomingPosition && input.cursor
                ? nextCursorColumns.relativeY
                : existing?.relativeY,
            revision: nextRevision,
            deviceId: input.sync?.deviceId ?? existing?.deviceId,
            clientEventId: input.sync?.clientEventId ?? existing?.clientEventId,
            lastServerSequence: nextServerSequence,
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
        return {
          status: 'saved' as const,
          entry: toReadingHistoryDto(saved, this.portableCursorEnabled),
        };
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
        await tx.readingProgressSyncEvent.deleteMany({
          where: { userId, storyId },
        });
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
        await tx.readingProgressSyncEvent.deleteMany({ where: { userId } });
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
  exposePortableCursor: boolean,
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
    ...(exposePortableCursor
      ? {
          cursor: row.cursor ? parseStoredCursor(row.cursor) : null,
        }
      : {}),
    revision: row.revision,
    deviceId: row.deviceId,
    clientEventId: row.clientEventId,
    lastServerSequence: row.lastServerSequence.toString(),
    progressPercent: Number(row.progressPercent),
    lastReadAt: row.lastReadAt.toISOString(),
  };
}

function parseStoredCursor(value: Prisma.JsonValue): ReadingCursor {
  return parseReadingCursor(value);
}

function toPrismaJson(cursor: ReadingCursor): Prisma.InputJsonValue {
  return cursor as unknown as Prisma.InputJsonValue;
}

function toCursorColumns(cursor: ReadingCursor | undefined): {
  readonly cursorType?: ReadingCursorType;
  readonly blockId?: string;
  readonly characterOffset?: number;
  readonly mediaAssetId?: string;
  readonly sliceId?: string;
  readonly relativeY?: number;
} {
  if (!cursor) return {};
  if (cursor.kind === 'text') {
    return {
      cursorType: ReadingCursorType.TEXT,
      blockId: cursor.blockId,
      characterOffset: cursor.characterOffset,
    };
  }
  return {
    cursorType: ReadingCursorType.COMIC,
    mediaAssetId: cursor.mediaAssetId,
    sliceId: cursor.sliceId,
    relativeY: cursor.relativeY,
  };
}

async function findProgressEntry(
  tx: Prisma.TransactionClient,
  userId: string,
  storyId: string,
  exposePortableCursor: boolean,
): Promise<ReadingHistoryEntryResultDto | null> {
  const row = await tx.readingProgress.findUnique({
    where: { userId_storyId: { userId, storyId } },
    select: READING_HISTORY_SELECT,
  });
  return row ? toReadingHistoryDto(row, exposePortableCursor) : null;
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

async function lockReadingProgressClientEvent(
  tx: Prisma.TransactionClient,
  userId: string,
  clientEventId: string,
): Promise<void> {
  await tx.$executeRaw(Prisma.sql`
    SELECT pg_advisory_xact_lock(
      hashtext('reading_progress_event:' || ${userId} || ':' || ${clientEventId})
    )
  `);
}
