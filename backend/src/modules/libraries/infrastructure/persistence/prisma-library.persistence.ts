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
  LibraryEntryResultDto,
  LibraryPersistencePort,
  LibraryStorySummaryDto,
  UpsertLibraryEntryInput,
  UpsertLibraryEntryResult,
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

const LIBRARY_STORY_SELECT = {
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

type LibraryStoryRow = Prisma.StoryGetPayload<{
  select: typeof LIBRARY_STORY_SELECT;
}>;

const LIBRARY_ENTRY_SELECT = {
  status: true,
  isFavorite: true,
  progressPercent: true,
  startedAt: true,
  completedAt: true,
  updatedAt: true,
  lastReadChapter: {
    select: { id: true, number: true, title: true },
  },
  story: { select: LIBRARY_STORY_SELECT },
} satisfies Prisma.LibraryEntrySelect;

type LibraryEntryRow = Prisma.LibraryEntryGetPayload<{
  select: typeof LIBRARY_ENTRY_SELECT;
}>;

@Injectable()
export class PrismaLibraryPersistence implements LibraryPersistencePort {
  constructor(private readonly prisma: PrismaService) {}

  async listMine(userId: string): Promise<readonly LibraryEntryResultDto[]> {
    try {
      const rows = await this.prisma.libraryEntry.findMany({
        where: { userId, story: PUBLIC_STORY_WHERE },
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

  async upsert(
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

  async removeMine(userId: string, storyId: string): Promise<void> {
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
}

function toLibraryStatus(value: string): LibraryStatus {
  switch (value) {
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

function toLibraryStorySummary(row: LibraryStoryRow): LibraryStorySummaryDto {
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
    story: toLibraryStorySummary(row.story),
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
