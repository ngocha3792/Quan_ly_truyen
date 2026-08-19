import { Injectable } from '@nestjs/common';

import {
  ChapterStatus,
  Prisma,
  StoryStatus,
  StoryVisibility,
} from '@/generated/prisma/client';
import { mapPrismaError, PrismaService } from '@/infrastructure/database';

import type {
  ReadingBookmarkPersistencePort,
  ReadingBookmarkResultDto,
  UpsertReadingBookmarkInput,
  UpsertReadingBookmarkResult,
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

const PUBLIC_CHAPTER_WHERE = {
  status: ChapterStatus.PUBLISHED,
  deletedAt: null,
  publishedAt: { not: null },
} satisfies Prisma.ChapterWhereInput;

const BOOKMARK_SELECT = {
  id: true,
  storyId: true,
  chapterId: true,
  position: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ReadingBookmarkSelect;

type ReadingBookmarkRow = Prisma.ReadingBookmarkGetPayload<{
  select: typeof BOOKMARK_SELECT;
}>;

@Injectable()
export class PrismaReadingBookmarkPersistence implements ReadingBookmarkPersistencePort {
  constructor(private readonly prisma: PrismaService) {}

  async listMine(userId: string): Promise<readonly ReadingBookmarkResultDto[]> {
    try {
      const rows = await this.prisma.readingBookmark.findMany({
        where: {
          userId,
          position: 0,
          story: PUBLIC_STORY_WHERE,
          chapter: PUBLIC_CHAPTER_WHERE,
        },
        orderBy: [{ updatedAt: 'desc' }, { chapterId: 'asc' }],
        select: BOOKMARK_SELECT,
      });

      return rows.map(toReadingBookmarkDto);
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'reading-bookmark-list-own',
        resource: 'Đánh dấu chương',
      });
    }
  }

  async getMineByChapter(
    userId: string,
    chapterId: string,
  ): Promise<ReadingBookmarkResultDto | null> {
    try {
      const row = await this.prisma.readingBookmark.findFirst({
        where: {
          userId,
          chapterId,
          position: 0,
          story: PUBLIC_STORY_WHERE,
          chapter: PUBLIC_CHAPTER_WHERE,
        },
        select: BOOKMARK_SELECT,
      });

      return row ? toReadingBookmarkDto(row) : null;
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'reading-bookmark-get-own',
        resource: 'Đánh dấu chương',
      });
    }
  }

  async upsertMine(
    input: UpsertReadingBookmarkInput,
  ): Promise<UpsertReadingBookmarkResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const chapter = await tx.chapter.findFirst({
          where: {
            id: input.chapterId,
            ...PUBLIC_CHAPTER_WHERE,
            story: PUBLIC_STORY_WHERE,
          },
          select: { id: true, storyId: true },
        });

        if (!chapter) return { status: 'chapter_not_found' as const };

        const bookmark = await tx.readingBookmark.upsert({
          where: {
            userId_chapterId_position: {
              userId: input.userId,
              chapterId: chapter.id,
              position: input.position,
            },
          },
          create: {
            userId: input.userId,
            storyId: chapter.storyId,
            chapterId: chapter.id,
            position: input.position,
          },
          update: {
            storyId: chapter.storyId,
          },
          select: BOOKMARK_SELECT,
        });

        return {
          status: 'saved' as const,
          bookmark: toReadingBookmarkDto(bookmark),
        };
      });
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'reading-bookmark-upsert-own',
        resource: 'Đánh dấu chương',
      });
    }
  }

  async removeMine(userId: string, chapterId: string): Promise<void> {
    try {
      await this.prisma.readingBookmark.deleteMany({
        where: { userId, chapterId, position: 0 },
      });
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'reading-bookmark-remove-own',
        resource: 'Đánh dấu chương',
      });
    }
  }
}

function toReadingBookmarkDto(
  row: ReadingBookmarkRow,
): ReadingBookmarkResultDto {
  return {
    id: row.id,
    storyId: row.storyId,
    chapterId: row.chapterId,
    position: row.position,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
