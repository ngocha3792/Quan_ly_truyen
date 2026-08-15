import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import {
  Prisma,
  StoryStatus,
  StoryVisibility,
} from '@/generated/prisma/client';
import { createUniqueSlug, slugify } from '@/common/utils';
import { mapPrismaError, PrismaService } from '@/infrastructure/database';

import type {
  CreateAuthorStoryInput,
  CreateAuthorStoryResult,
  DeleteAuthorStoryInput,
  DeleteAuthorStoryResult,
  StoryPersistencePort,
  StoryRecord,
  UpdateAuthorStoryInput,
  UpdateAuthorStoryResult,
} from '../../application';
import { StoryDraftPolicy } from '../../domain';

const STORY_SELECT = {
  id: true,
  authorId: true,
  title: true,
  slug: true,
  synopsis: true,
  languageCode: true,
  status: true,
  visibility: true,
  contentRating: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.StorySelect;

type StoryRow = Prisma.StoryGetPayload<{
  select: typeof STORY_SELECT;
}>;

@Injectable()
export class PrismaStoryPersistence implements StoryPersistencePort {
  constructor(private readonly prisma: PrismaService) {}

  async createDraft(
    input: CreateAuthorStoryInput,
  ): Promise<CreateAuthorStoryResult> {
    const storyId = randomUUID();
    const baseSlug = createStoryBaseSlug(input.title, storyId);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const slug =
        attempt === 0
          ? baseSlug
          : createUniqueSlug(baseSlug, storyId.slice(0, 8)).slice(
              0,
              StoryDraftPolicy.SLUG_MAX_LENGTH,
            );

      try {
        return await this.prisma.$transaction(async (tx) => {
          const author = await tx.authorProfile.findUnique({
            where: {
              userId: input.userId,
            },
            select: {
              userId: true,
            },
          });

          if (!author) {
            return {
              status: 'author_not_found',
            };
          }

          const story = await tx.story.create({
            data: {
              id: storyId,
              authorId: input.userId,
              title: input.title,
              slug,
              synopsis: input.synopsis,
              status: StoryStatus.DRAFT,
              visibility: StoryVisibility.PRIVATE,
              createdAt: input.createdAt,
              updatedAt: input.createdAt,
            },
            select: STORY_SELECT,
          });

          await tx.authorProfile.update({
            where: {
              userId: input.userId,
            },
            data: {
              storyCount: {
                increment: 1,
              },
            },
          });

          await tx.auditLog.create({
            data: {
              actorId: input.userId,
              action: 'story.draft.created',
              entityType: 'story',
              entityId: story.id,
              newValues: {
                title: story.title,
                slug: story.slug,
                status: story.status,
                visibility: story.visibility,
              },
              ipAddress: input.audit.ipAddress,
              userAgent: input.audit.userAgent,
              requestId: input.audit.requestId,
              createdAt: input.createdAt,
            },
          });

          return {
            status: 'created',
            story: this.toRecord(story),
          };
        });
      } catch (error: unknown) {
        if (attempt === 0 && isUniqueConstraintViolation(error)) {
          continue;
        }

        throw mapPrismaError(error, {
          operation: 'story-draft-create',
          resource: 'Truyện',
        });
      }
    }

    throw new Error('Unreachable story slug retry state');
  }

  async updateDraft(
    input: UpdateAuthorStoryInput,
  ): Promise<UpdateAuthorStoryResult> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const locked = await lockStoryRow(tx, input.storyId);

          if (!locked) {
            return {
              status: 'not_found',
            };
          }

          const current = await tx.story.findFirst({
            where: {
              id: input.storyId,
              authorId: input.userId,
              deletedAt: null,
            },
            select: STORY_SELECT,
          });

          if (!current) {
            return {
              status: 'not_found',
            };
          }

          if (current.status !== StoryStatus.DRAFT) {
            return {
              status: 'not_draft',
            };
          }

          const titleChanged =
            input.title !== undefined && input.title !== current.title;
          const synopsisChanged =
            input.synopsis !== undefined && input.synopsis !== current.synopsis;

          if (!titleChanged && !synopsisChanged) {
            return {
              status: 'updated',
              story: this.toRecord(current),
            };
          }

          const nextSlug =
            titleChanged && input.title !== undefined
              ? await createAvailableStorySlug(tx, input.title, current.id)
              : current.slug;

          const updated = await tx.story.update({
            where: {
              id: current.id,
            },
            data: {
              ...(titleChanged
                ? {
                    title: input.title,
                    slug: nextSlug,
                  }
                : {}),
              ...(synopsisChanged
                ? {
                    synopsis: input.synopsis,
                  }
                : {}),
              version: {
                increment: 1,
              },
              updatedAt: input.updatedAt,
            },
            select: STORY_SELECT,
          });

          await tx.auditLog.create({
            data: {
              actorId: input.userId,
              action: 'story.draft.updated',
              entityType: 'story',
              entityId: current.id,
              oldValues: {
                title: current.title,
                slug: current.slug,
                synopsisLength: current.synopsis.length,
                version: current.version,
              },
              newValues: {
                title: updated.title,
                slug: updated.slug,
                synopsisLength: updated.synopsis.length,
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
            story: this.toRecord(updated),
          };
        });
      } catch (error: unknown) {
        if (attempt === 0 && isUniqueConstraintViolation(error)) {
          continue;
        }

        throw mapPrismaError(error, {
          operation: 'story-draft-update',
          resource: 'Truyện',
        });
      }
    }

    throw new Error('Unreachable story slug retry state');
  }

  async deleteDraft(
    input: DeleteAuthorStoryInput,
  ): Promise<DeleteAuthorStoryResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const locked = await lockStoryRow(tx, input.storyId);

        if (!locked) {
          return {
            status: 'not_found',
          };
        }

        const current = await tx.story.findFirst({
          where: {
            id: input.storyId,
            authorId: input.userId,
            deletedAt: null,
          },
          select: STORY_SELECT,
        });

        if (!current) {
          return {
            status: 'not_found',
          };
        }

        if (current.status !== StoryStatus.DRAFT) {
          return {
            status: 'not_draft',
          };
        }

        await tx.story.update({
          where: {
            id: current.id,
          },
          data: {
            deletedAt: input.deletedAt,
            updatedAt: input.deletedAt,
            version: {
              increment: 1,
            },
          },
        });

        await tx.authorProfile.updateMany({
          where: {
            userId: input.userId,
            storyCount: {
              gt: 0,
            },
          },
          data: {
            storyCount: {
              decrement: 1,
            },
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: input.userId,
            action: 'story.draft.deleted',
            entityType: 'story',
            entityId: current.id,
            oldValues: {
              title: current.title,
              slug: current.slug,
              status: current.status,
              version: current.version,
            },
            newValues: {
              deletedAt: input.deletedAt.toISOString(),
              version: current.version + 1,
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
        operation: 'story-draft-delete',
        resource: 'Truyện',
      });
    }
  }

  private toRecord(story: StoryRow): StoryRecord {
    return {
      id: story.id,
      authorId: story.authorId,
      title: story.title,
      slug: story.slug,
      synopsis: story.synopsis,
      languageCode: story.languageCode,
      status: story.status,
      visibility: story.visibility,
      contentRating: story.contentRating,
      version: story.version,
      createdAt: story.createdAt,
      updatedAt: story.updatedAt,
    };
  }
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

function createStoryBaseSlug(title: string, storyId: string): string {
  return (
    slugify(title, {
      maxLength: StoryDraftPolicy.SLUG_MAX_LENGTH,
    }) || `story-${storyId.slice(0, 8)}`
  );
}

async function createAvailableStorySlug(
  tx: Prisma.TransactionClient,
  title: string,
  storyId: string,
): Promise<string> {
  const base = createStoryBaseSlug(title, storyId);
  const existing = await tx.story.findFirst({
    where: {
      slug: base,
      id: {
        not: storyId,
      },
    },
    select: {
      id: true,
    },
  });

  if (!existing) {
    return base;
  }

  return createUniqueSlug(base, storyId.slice(0, 8)).slice(
    0,
    StoryDraftPolicy.SLUG_MAX_LENGTH,
  );
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}
