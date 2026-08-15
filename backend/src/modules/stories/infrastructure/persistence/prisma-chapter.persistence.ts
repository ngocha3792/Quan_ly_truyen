import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import {
  ChapterStatus,
  ContentFormat,
  Prisma,
} from '@/generated/prisma/client';
import { slugify } from '@/common/utils';
import { mapPrismaError, PrismaService } from '@/infrastructure/database';

import type {
  ChapterPersistencePort,
  ChapterRecord,
  CreateAuthorChapterInput,
  CreateAuthorChapterResult,
  DeleteAuthorChapterInput,
  DeleteAuthorChapterResult,
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

@Injectable()
export class PrismaChapterPersistence implements ChapterPersistencePort {
  constructor(private readonly prisma: PrismaService) {}

  async createDraft(
    input: CreateAuthorChapterInput,
  ): Promise<CreateAuthorChapterResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const storyLocked = await lockStoryRow(tx, input.storyId);

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
          },
        });

        if (!story) {
          return {
            status: 'story_not_found',
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

        const chapterLocked = await lockChapterRow(tx, input.chapterId);

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

        const chapterLocked = await lockChapterRow(tx, input.chapterId);

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
): Promise<{ readonly id: string } | null> {
  const locked = await lockStoryRow(tx, storyId);

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
    },
  });
}

async function lockStoryRow(
  tx: Prisma.TransactionClient,
  storyId: string,
): Promise<boolean> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "stories"
    WHERE "id" = ${storyId}::uuid
    FOR UPDATE
  `);

  return rows.length === 1;
}

async function lockChapterRow(
  tx: Prisma.TransactionClient,
  chapterId: string,
): Promise<boolean> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "chapters"
    WHERE "id" = ${chapterId}::uuid
    FOR UPDATE
  `);

  return rows.length === 1;
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
