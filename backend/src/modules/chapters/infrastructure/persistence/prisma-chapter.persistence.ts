import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import {
  ChapterStatus,
  ContentFormat,
  Prisma,
  StoryStatus,
  StoryVisibility,
} from '@/generated/prisma/client';
import { slugify } from '@/common/utils';
import { mapPrismaError, PrismaService } from '@/infrastructure/database';

import type {
  ChapterPersistencePort,
  ChapterRecord,
  ChapterSummaryRecord,
  PublicChapterReaderDto,
  PublicStoryChapterListDto,
  PublicStoryChapterListItemDto,
  CreateAuthorChapterInput,
  CreateAuthorChapterResult,
  DeleteAuthorChapterInput,
  DeleteAuthorChapterResult,
  PublishAuthorChapterInput,
  PublishAuthorChapterResult,
  UpdateAuthorChapterInput,
  UpdateAuthorChapterResult,
} from '../../application';
import { ChapterDraftPolicy } from '../../domain';

const CHAPTER_SELECT = {
  id: true,
  storyId: true,
  createdById: true,
  updatedById: true,
  number: true,
  title: true,
  slug: true,
  content: true,
  contentFormat: true,
  status: true,
  wordCount: true,
  version: true,
  scheduledAt: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ChapterSelect;

type ChapterRow = Prisma.ChapterGetPayload<{
  select: typeof CHAPTER_SELECT;
}>;

const CHAPTER_SUMMARY_SELECT = {
  id: true,
  storyId: true,
  number: true,
  title: true,
  slug: true,
  status: true,
  wordCount: true,
  version: true,
  scheduledAt: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ChapterSelect;

type ChapterSummaryRow = Prisma.ChapterGetPayload<{
  select: typeof CHAPTER_SUMMARY_SELECT;
}>;

const PUBLIC_CHAPTER_READER_SELECT = {
  id: true,
  storyId: true,
  number: true,
  title: true,
  slug: true,
  content: true,
  contentFormat: true,
  wordCount: true,
  viewCount: true,
  commentCount: true,
  publishedAt: true,
  updatedAt: true,
  story: {
    select: {
      id: true,
      slug: true,
      title: true,
    },
  },
} satisfies Prisma.ChapterSelect;

type PublicChapterReaderRow = Prisma.ChapterGetPayload<{
  select: typeof PUBLIC_CHAPTER_READER_SELECT;
}>;

const PUBLIC_CHAPTER_NAVIGATION_SELECT = {
  id: true,
  number: true,
  title: true,
  slug: true,
  publishedAt: true,
} satisfies Prisma.ChapterSelect;

type PublicChapterNavigationRow = Prisma.ChapterGetPayload<{
  select: typeof PUBLIC_CHAPTER_NAVIGATION_SELECT;
}>;

const PUBLIC_STORY_STATUSES = [
  StoryStatus.PUBLISHED,
  StoryStatus.HIATUS,
  StoryStatus.COMPLETED,
] as const;

@Injectable()
export class PrismaChapterPersistence implements ChapterPersistencePort {
  constructor(private readonly prisma: PrismaService) {}

  async listOwnedByStory(
    userId: string,
    storyId: string,
  ): Promise<readonly ChapterSummaryRecord[] | null> {
    try {
      const story = await this.prisma.story.findFirst({
        where: {
          id: storyId,
          authorId: userId,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (!story) {
        return null;
      }

      const chapters = await this.prisma.chapter.findMany({
        where: {
          storyId,
          deletedAt: null,
        },
        orderBy: [{ number: 'asc' }, { id: 'asc' }],
        select: CHAPTER_SUMMARY_SELECT,
      });

      return chapters.map((chapter) => this.toSummaryRecord(chapter));
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'author-chapter-list',
        resource: 'Chương',
      });
    }
  }

  async findOwnedById(
    userId: string,
    storyId: string,
    chapterId: string,
  ): Promise<ChapterRecord | null> {
    try {
      const chapter = await this.prisma.chapter.findFirst({
        where: {
          id: chapterId,
          storyId,
          deletedAt: null,
          story: {
            authorId: userId,
            deletedAt: null,
          },
        },
        select: CHAPTER_SELECT,
      });

      return chapter ? this.toRecord(chapter) : null;
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'author-chapter-detail',
        resource: 'Chương',
      });
    }
  }

  async createDraft(
    input: CreateAuthorChapterInput,
  ): Promise<CreateAuthorChapterResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const storyLocked = await lockOwnedStoryRow(
          tx,
          input.storyId,
          input.userId,
        );

        if (!storyLocked) {
          return {
            status: 'story_not_found',
          };
        }

        const story = await tx.story.findFirst({
          where: {
            id: input.storyId,
            authorId: input.userId,
            deletedAt: null,
          },
          select: {
            id: true,
            status: true,
          },
        });

        if (!story) {
          return {
            status: 'story_not_found',
          };
        }

        if (story.status === StoryStatus.PENDING_REVIEW) {
          return {
            status: 'story_pending_review',
          };
        }

        const lastChapter = await tx.chapter.findFirst({
          where: {
            storyId: story.id,
          },
          orderBy: {
            number: 'desc',
          },
          select: {
            number: true,
          },
        });
        const number = Math.floor(lastChapter?.number.toNumber() ?? 0) + 1;
        const chapterId = randomUUID();
        const slug = createChapterSlug(number, input.title);

        const chapter = await tx.chapter.create({
          data: {
            id: chapterId,
            storyId: story.id,
            createdById: input.userId,
            updatedById: input.userId,
            number,
            title: input.title,
            slug,
            content: input.content,
            contentFormat: ContentFormat.MARKDOWN,
            status: ChapterStatus.DRAFT,
            wordCount: input.wordCount,
            version: 1,
            createdAt: input.createdAt,
            updatedAt: input.createdAt,
            versions: {
              create: {
                createdById: input.userId,
                version: 1,
                title: input.title,
                content: input.content,
                contentFormat: ContentFormat.MARKDOWN,
                wordCount: input.wordCount,
                createdAt: input.createdAt,
              },
            },
          },
          select: CHAPTER_SELECT,
        });

        await tx.auditLog.create({
          data: {
            actorId: input.userId,
            action: 'chapter.draft.created',
            entityType: 'chapter',
            entityId: chapter.id,
            newValues: {
              storyId: chapter.storyId,
              number: chapter.number.toString(),
              title: chapter.title,
              slug: chapter.slug,
              contentFormat: chapter.contentFormat,
              contentLength: chapter.content.length,
              wordCount: chapter.wordCount,
              status: chapter.status,
              version: chapter.version,
            },
            ipAddress: input.audit.ipAddress,
            userAgent: input.audit.userAgent,
            requestId: input.audit.requestId,
            createdAt: input.createdAt,
          },
        });

        return {
          status: 'created',
          chapter: this.toRecord(chapter),
        };
      });
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'chapter-draft-create',
        resource: 'Chương',
      });
    }
  }

  async updateDraft(
    input: UpdateAuthorChapterInput,
  ): Promise<UpdateAuthorChapterResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const story = await lockAndFindOwnedStory(
          tx,
          input.storyId,
          input.userId,
        );

        if (!story) {
          return {
            status: 'not_found',
          };
        }

        if (story.status === StoryStatus.PENDING_REVIEW) {
          return {
            status: 'story_pending_review',
          };
        }

        const chapterLocked = await lockChapterRowForStory(
          tx,
          input.chapterId,
          story.id,
        );

        if (!chapterLocked) {
          return {
            status: 'not_found',
          };
        }

        const current = await tx.chapter.findFirst({
          where: {
            id: input.chapterId,
            storyId: story.id,
            deletedAt: null,
          },
          select: CHAPTER_SELECT,
        });

        if (!current) {
          return {
            status: 'not_found',
          };
        }

        if (current.status !== ChapterStatus.DRAFT) {
          return {
            status: 'not_draft',
          };
        }

        const titleChanged =
          input.title !== undefined && input.title !== current.title;
        const contentChanged =
          input.content !== undefined && input.content !== current.content;

        if (!titleChanged && !contentChanged) {
          return {
            status: 'updated',
            chapter: this.toRecord(current),
          };
        }

        const nextTitle =
          titleChanged && input.title !== undefined
            ? input.title
            : current.title;
        const nextContent =
          contentChanged && input.content !== undefined
            ? input.content
            : current.content;
        const nextWordCount = contentChanged
          ? (input.wordCount ?? current.wordCount)
          : current.wordCount;
        const nextSlug = titleChanged
          ? createChapterSlug(current.number.toNumber(), nextTitle)
          : current.slug;
        const nextVersion = current.version + 1;

        const updated = await tx.chapter.update({
          where: {
            id: current.id,
          },
          data: {
            ...(titleChanged
              ? {
                  title: nextTitle,
                  slug: nextSlug,
                }
              : {}),
            ...(contentChanged
              ? {
                  content: nextContent,
                  wordCount: nextWordCount,
                }
              : {}),
            updatedById: input.userId,
            updatedAt: input.updatedAt,
            version: nextVersion,
            versions: {
              create: {
                createdById: input.userId,
                version: nextVersion,
                title: nextTitle,
                content: nextContent,
                contentFormat: current.contentFormat,
                wordCount: nextWordCount,
                createdAt: input.updatedAt,
              },
            },
          },
          select: CHAPTER_SELECT,
        });

        await tx.auditLog.create({
          data: {
            actorId: input.userId,
            action: 'chapter.draft.updated',
            entityType: 'chapter',
            entityId: current.id,
            oldValues: {
              storyId: current.storyId,
              number: current.number.toString(),
              title: current.title,
              slug: current.slug,
              contentLength: current.content.length,
              wordCount: current.wordCount,
              version: current.version,
            },
            newValues: {
              storyId: updated.storyId,
              number: updated.number.toString(),
              title: updated.title,
              slug: updated.slug,
              contentLength: updated.content.length,
              contentChanged,
              wordCount: updated.wordCount,
              version: updated.version,
            },
            ipAddress: input.audit.ipAddress,
            userAgent: input.audit.userAgent,
            requestId: input.audit.requestId,
            createdAt: input.updatedAt,
          },
        });

        return {
          status: 'updated',
          chapter: this.toRecord(updated),
        };
      });
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'chapter-draft-update',
        resource: 'Chương',
      });
    }
  }

  async deleteDraft(
    input: DeleteAuthorChapterInput,
  ): Promise<DeleteAuthorChapterResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const story = await lockAndFindOwnedStory(
          tx,
          input.storyId,
          input.userId,
        );

        if (!story) {
          return {
            status: 'not_found',
          };
        }

        if (story.status === StoryStatus.PENDING_REVIEW) {
          return {
            status: 'story_pending_review',
          };
        }

        const chapterLocked = await lockChapterRowForStory(
          tx,
          input.chapterId,
          story.id,
        );

        if (!chapterLocked) {
          return {
            status: 'not_found',
          };
        }

        const current = await tx.chapter.findFirst({
          where: {
            id: input.chapterId,
            storyId: story.id,
            deletedAt: null,
          },
          select: CHAPTER_SELECT,
        });

        if (!current) {
          return {
            status: 'not_found',
          };
        }

        if (current.status !== ChapterStatus.DRAFT) {
          return {
            status: 'not_draft',
          };
        }

        await tx.chapter.update({
          where: {
            id: current.id,
          },
          data: {
            deletedAt: input.deletedAt,
            updatedById: input.userId,
            updatedAt: input.deletedAt,
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: input.userId,
            action: 'chapter.draft.deleted',
            entityType: 'chapter',
            entityId: current.id,
            oldValues: {
              storyId: current.storyId,
              number: current.number.toString(),
              title: current.title,
              slug: current.slug,
              status: current.status,
              version: current.version,
            },
            newValues: {
              deletedAt: input.deletedAt.toISOString(),
              version: current.version,
            },
            ipAddress: input.audit.ipAddress,
            userAgent: input.audit.userAgent,
            requestId: input.audit.requestId,
            createdAt: input.deletedAt,
          },
        });

        return {
          status: 'deleted',
        };
      });
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'chapter-draft-delete',
        resource: 'Chương',
      });
    }
  }

  async publish(
    input: PublishAuthorChapterInput,
  ): Promise<PublishAuthorChapterResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const storyLocked = await lockOwnedStoryRow(
          tx,
          input.storyId,
          input.userId,
        );
        if (!storyLocked) {
          return { status: 'not_found' };
        }
        const story = await tx.story.findFirst({
          where: { id: input.storyId, authorId: input.userId, deletedAt: null },
          select: {
            id: true,
            status: true,
            slug: true,
            title: true,
            authorId: true,
          },
        });
        if (!story) {
          return { status: 'not_found' };
        }
        if (story.status !== StoryStatus.PUBLISHED) {
          return { status: 'story_not_published' };
        }
        if (!(await lockChapterRowForStory(tx, input.chapterId, story.id))) {
          return { status: 'not_found' };
        }
        const current = await tx.chapter.findFirst({
          where: { id: input.chapterId, storyId: story.id, deletedAt: null },
          select: CHAPTER_SELECT,
        });
        if (!current) {
          return { status: 'not_found' };
        }
        if (current.status !== ChapterStatus.DRAFT) {
          return { status: 'not_draft' };
        }
        if (!current.content.trim()) {
          return { status: 'empty_content' };
        }

        const updated = await tx.chapter.update({
          where: { id: current.id },
          data: {
            status: ChapterStatus.PUBLISHED,
            publishedAt: input.publishedAt,
            scheduledAt: null,
            updatedById: input.userId,
            updatedAt: input.publishedAt,
          },
          select: CHAPTER_SELECT,
        });
        await tx.story.update({
          where: { id: story.id },
          data: {
            chapterCount: { increment: 1 },
            lastChapterAt: input.publishedAt,
            updatedAt: input.publishedAt,
            version: { increment: 1 },
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: input.userId,
            action: 'chapter.published',
            entityType: 'chapter',
            entityId: current.id,
            oldValues: {
              storyId: current.storyId,
              status: current.status,
              publishedAt: current.publishedAt,
            },
            newValues: {
              storyId: updated.storyId,
              status: updated.status,
              publishedAt: updated.publishedAt?.toISOString() ?? null,
            },
            ipAddress: input.audit.ipAddress,
            userAgent: input.audit.userAgent,
            requestId: input.audit.requestId,
            createdAt: input.publishedAt,
          },
        });
        await tx.outboxEvent.create({
          data: {
            idempotencyKey: `author-chapter-published:${current.id}`,
            aggregateType: 'notifications',
            aggregateId: current.id,
            eventType: 'notification.author-chapter-published.v1',
            payload: {
              version: 1,
              authorId: story.authorId,
              storyId: story.id,
              storySlug: story.slug,
              storyTitle: story.title,
              chapterId: updated.id,
              chapterNumber: updated.number.toString(),
              chapterTitle: updated.title,
              publishedAt: input.publishedAt.toISOString(),
            },
            metadata: {
              requestId: input.audit.requestId ?? null,
            },
            createdAt: input.publishedAt,
          },
        });
        return { status: 'published', chapter: this.toRecord(updated) };
      });
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'chapter-publish',
        resource: 'Chương',
      });
    }
  }

  async findPublicReader(
    storySlug: string,
    chapterNumber: string,
  ): Promise<PublicChapterReaderDto | null> {
    try {
      const chapter = await this.prisma.chapter.findFirst({
        where: {
          number: chapterNumber,
          status: ChapterStatus.PUBLISHED,
          deletedAt: null,
          publishedAt: {
            not: null,
          },
          story: {
            slug: storySlug,
            deletedAt: null,
            visibility: StoryVisibility.PUBLIC,
            publishedAt: {
              not: null,
            },
            status: {
              in: [...PUBLIC_STORY_STATUSES],
            },
          },
        },
        select: PUBLIC_CHAPTER_READER_SELECT,
      });

      if (!chapter?.publishedAt) {
        return null;
      }

      const publicStoryWhere = {
        deletedAt: null,
        visibility: StoryVisibility.PUBLIC,
        publishedAt: {
          not: null,
        },
        status: {
          in: [...PUBLIC_STORY_STATUSES],
        },
      } satisfies Prisma.StoryWhereInput;

      const [previous, next] = await Promise.all([
        this.prisma.chapter.findFirst({
          where: {
            storyId: chapter.storyId,
            number: {
              lt: chapter.number,
            },
            status: ChapterStatus.PUBLISHED,
            deletedAt: null,
            publishedAt: {
              not: null,
            },
            story: publicStoryWhere,
          },
          orderBy: {
            number: 'desc',
          },
          select: PUBLIC_CHAPTER_NAVIGATION_SELECT,
        }),
        this.prisma.chapter.findFirst({
          where: {
            storyId: chapter.storyId,
            number: {
              gt: chapter.number,
            },
            status: ChapterStatus.PUBLISHED,
            deletedAt: null,
            publishedAt: {
              not: null,
            },
            story: publicStoryWhere,
          },
          orderBy: {
            number: 'asc',
          },
          select: PUBLIC_CHAPTER_NAVIGATION_SELECT,
        }),
      ]);

      return toPublicChapterReaderDto(
        chapter,
        previous,
        next,
        chapter.publishedAt,
      );
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'public-chapter-reader',
        resource: 'Chương',
      });
    }
  }

  async listPublishedByStory(
    storySlug: string,
    page: number,
    pageSize: number,
  ): Promise<PublicStoryChapterListDto | null> {
    try {
      const story = await this.prisma.story.findFirst({
        where: {
          slug: storySlug,
          deletedAt: null,
          visibility: StoryVisibility.PUBLIC,
          publishedAt: {
            not: null,
          },
          status: {
            in: [...PUBLIC_STORY_STATUSES],
          },
        },
        select: { id: true },
      });

      if (!story) {
        return null;
      }

      const where = {
        storyId: story.id,
        status: ChapterStatus.PUBLISHED,
        deletedAt: null,
        publishedAt: {
          not: null,
        },
      } satisfies Prisma.ChapterWhereInput;

      const [totalItems, chapters] = await this.prisma.$transaction([
        this.prisma.chapter.count({ where }),
        this.prisma.chapter.findMany({
          where,
          orderBy: {
            number: 'asc',
          },
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: PUBLIC_CHAPTER_NAVIGATION_SELECT,
        }),
      ]);

      return {
        items: chapters
          .map((chapter) => toPublicStoryChapterListItemDto(chapter))
          .filter(
            (item): item is PublicStoryChapterListItemDto => item !== null,
          ),
        pagination: {
          page,
          pageSize,
          totalItems,
          totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize),
        },
      };
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'public-story-chapter-list',
        resource: 'Chương',
      });
    }
  }

  private toSummaryRecord(chapter: ChapterSummaryRow): ChapterSummaryRecord {
    return {
      id: chapter.id,
      storyId: chapter.storyId,
      number: chapter.number.toNumber(),
      title: chapter.title,
      slug: chapter.slug,
      status: chapter.status,
      wordCount: chapter.wordCount,
      version: chapter.version,
      scheduledAt: chapter.scheduledAt,
      publishedAt: chapter.publishedAt,
      createdAt: chapter.createdAt,
      updatedAt: chapter.updatedAt,
    };
  }

  private toRecord(chapter: ChapterRow): ChapterRecord {
    return {
      id: chapter.id,
      storyId: chapter.storyId,
      createdById: chapter.createdById,
      updatedById: chapter.updatedById,
      number: chapter.number.toNumber(),
      title: chapter.title,
      slug: chapter.slug,
      content: chapter.content,
      contentFormat: chapter.contentFormat,
      status: chapter.status,
      wordCount: chapter.wordCount,
      version: chapter.version,
      scheduledAt: chapter.scheduledAt,
      publishedAt: chapter.publishedAt,
      createdAt: chapter.createdAt,
      updatedAt: chapter.updatedAt,
    };
  }
}

async function lockAndFindOwnedStory(
  tx: Prisma.TransactionClient,
  storyId: string,
  userId: string,
): Promise<{ readonly id: string; readonly status: StoryStatus } | null> {
  const locked = await lockOwnedStoryRow(tx, storyId, userId);

  if (!locked) {
    return null;
  }

  return tx.story.findFirst({
    where: {
      id: storyId,
      authorId: userId,
      deletedAt: null,
    },
    select: {
      id: true,
      status: true,
    },
  });
}

async function lockOwnedStoryRow(
  tx: Prisma.TransactionClient,
  storyId: string,
  userId: string,
): Promise<boolean> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "stories"
    WHERE "id" = ${storyId}::uuid
      AND "author_id" = ${userId}::uuid
      AND "deleted_at" IS NULL
    FOR UPDATE
  `);

  return rows.length === 1;
}

async function lockChapterRowForStory(
  tx: Prisma.TransactionClient,
  chapterId: string,
  storyId: string,
): Promise<boolean> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "chapters"
    WHERE "id" = ${chapterId}::uuid
      AND "story_id" = ${storyId}::uuid
      AND "deleted_at" IS NULL
    FOR UPDATE
  `);

  return rows.length === 1;
}

function toPublicChapterReaderDto(
  chapter: PublicChapterReaderRow,
  previous: PublicChapterNavigationRow | null,
  next: PublicChapterNavigationRow | null,
  publishedAt: Date,
): PublicChapterReaderDto {
  return {
    story: {
      id: chapter.story.id,
      slug: chapter.story.slug,
      title: chapter.story.title,
    },
    chapter: {
      id: chapter.id,
      number: chapter.number.toNumber(),
      title: chapter.title,
      slug: chapter.slug,
      content: chapter.content,
      contentFormat: chapter.contentFormat,
      wordCount: chapter.wordCount,
      views: bigintToSafeNumber(chapter.viewCount),
      comments: chapter.commentCount,
      publishedAt,
      updatedAt: chapter.updatedAt,
    },
    navigation: {
      previous: toPublicChapterNavigation(previous),
      next: toPublicChapterNavigation(next),
    },
  };
}

function toPublicChapterNavigation(
  chapter: PublicChapterNavigationRow | null,
): PublicChapterReaderDto['navigation']['previous'] {
  if (!chapter?.publishedAt) {
    return null;
  }

  return {
    id: chapter.id,
    number: chapter.number.toNumber(),
    title: chapter.title,
    slug: chapter.slug,
    publishedAt: chapter.publishedAt,
  };
}

function toPublicStoryChapterListItemDto(
  chapter: PublicChapterNavigationRow,
): PublicStoryChapterListItemDto | null {
  if (!chapter.publishedAt) {
    return null;
  }

  return {
    id: chapter.id,
    number: chapter.number.toNumber(),
    title: chapter.title,
    slug: chapter.slug,
    publishedAt: chapter.publishedAt,
  };
}

function bigintToSafeNumber(value: bigint): number {
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  if (value > max) {
    return Number.MAX_SAFE_INTEGER;
  }
  if (value < -max) {
    return -Number.MAX_SAFE_INTEGER;
  }
  return Number(value);
}

function createChapterSlug(number: number, title: string): string {
  const numberPart = formatChapterNumber(number);
  const titlePart = slugify(title, {
    maxLength: ChapterDraftPolicy.SLUG_MAX_LENGTH,
  });
  const prefix = `chuong-${numberPart}`;
  const maxTitleLength = Math.max(
    0,
    ChapterDraftPolicy.SLUG_MAX_LENGTH - prefix.length - 1,
  );
  const trimmedTitle = titlePart.slice(0, maxTitleLength).replace(/-+$/g, '');
  return [prefix, trimmedTitle].filter(Boolean).join('-');
}

function formatChapterNumber(number: number): string {
  return String(number).replace('.', '-');
}
