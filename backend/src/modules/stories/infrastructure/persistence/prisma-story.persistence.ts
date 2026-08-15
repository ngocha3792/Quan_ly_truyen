import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import {
  MediaPurpose,
  MediaResourceType,
  MediaStatus,
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
  StoryTaxonomyCategoryRecord,
  StoryTaxonomyTagRecord,
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
  coverMediaId: true,
  categories: {
    select: {
      isPrimary: true,
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  },
  tags: {
    select: {
      tag: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  },
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

          const taxonomyValidation = await validateTaxonomy(
            tx,
            input.categoryIds,
            input.tagIds,
          );

          if (taxonomyValidation.status !== 'valid') {
            return taxonomyValidation;
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
              ...(input.categoryIds.length > 0
                ? {
                    categories: {
                      create: input.categoryIds.map((categoryId, index) => ({
                        isPrimary: index === 0,
                        category: {
                          connect: {
                            id: categoryId,
                          },
                        },
                      })),
                    },
                  }
                : {}),
              ...(input.tagIds.length > 0
                ? {
                    tags: {
                      create: input.tagIds.map((tagId) => ({
                        tag: {
                          connect: {
                            id: tagId,
                          },
                        },
                      })),
                    },
                  }
                : {}),
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
                categoryIds: [...input.categoryIds],
                primaryCategoryId: input.categoryIds[0] ?? null,
                tagIds: [...input.tagIds],
                coverMediaId: null,
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

          const taxonomyValidation = await validateTaxonomy(
            tx,
            input.categoryIds,
            input.tagIds,
          );

          if (taxonomyValidation.status !== 'valid') {
            return taxonomyValidation;
          }

          const titleChanged =
            input.title !== undefined && input.title !== current.title;
          const synopsisChanged =
            input.synopsis !== undefined && input.synopsis !== current.synopsis;
          const categoriesChanged = hasCategoryChanges(
            current,
            input.categoryIds,
          );
          const tagsChanged = hasTagChanges(current, input.tagIds);
          const coverChanged =
            input.coverMediaId !== undefined &&
            input.coverMediaId !== current.coverMediaId;

          if (coverChanged && input.coverMediaId !== null) {
            const validCover = await validateAndLockStoryCover(
              tx,
              input.coverMediaId,
              input.userId,
              current.id,
            );

            if (!validCover) {
              return {
                status: 'invalid_cover',
              };
            }
          }

          if (
            !titleChanged &&
            !synopsisChanged &&
            !categoriesChanged &&
            !tagsChanged &&
            !coverChanged
          ) {
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
              ...(categoriesChanged && input.categoryIds !== undefined
                ? {
                    categories: {
                      deleteMany: {},
                      ...(input.categoryIds.length > 0
                        ? {
                            create: input.categoryIds.map(
                              (categoryId, index) => ({
                                isPrimary: index === 0,
                                category: {
                                  connect: {
                                    id: categoryId,
                                  },
                                },
                              }),
                            ),
                          }
                        : {}),
                    },
                  }
                : {}),
              ...(tagsChanged && input.tagIds !== undefined
                ? {
                    tags: {
                      deleteMany: {},
                      ...(input.tagIds.length > 0
                        ? {
                            create: input.tagIds.map((tagId) => ({
                              tag: {
                                connect: {
                                  id: tagId,
                                },
                              },
                            })),
                          }
                        : {}),
                    },
                  }
                : {}),
              ...(coverChanged
                ? {
                    coverMediaId: input.coverMediaId,
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
                categoryIds: current.categories.map(
                  ({ category }) => category.id,
                ),
                primaryCategoryId: getPrimaryCategoryId(current),
                tagIds: current.tags.map(({ tag }) => tag.id),
                coverMediaId: current.coverMediaId,
                version: current.version,
              },
              newValues: {
                title: updated.title,
                slug: updated.slug,
                synopsisLength: updated.synopsis.length,
                categoryIds: updated.categories.map(
                  ({ category }) => category.id,
                ),
                primaryCategoryId: getPrimaryCategoryId(updated),
                tagIds: updated.tags.map(({ tag }) => tag.id),
                coverMediaId: updated.coverMediaId,
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

        const deletedChapters = await tx.chapter.updateMany({
          where: {
            storyId: current.id,
            deletedAt: null,
          },
          data: {
            deletedAt: input.deletedAt,
            updatedAt: input.deletedAt,
            updatedById: input.userId,
          },
        });

        await tx.story.update({
          where: {
            id: current.id,
          },
          data: {
            deletedAt: input.deletedAt,
            coverMediaId: null,
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
              coverMediaId: current.coverMediaId,
              version: current.version,
            },
            newValues: {
              deletedAt: input.deletedAt.toISOString(),
              coverMediaId: null,
              deletedChapterCount: deletedChapters.count,
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

  async listActiveCategories(): Promise<
    readonly StoryTaxonomyCategoryRecord[]
  > {
    return this.prisma.category.findMany({
      where: {
        isActive: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        parentId: true,
        name: true,
        slug: true,
        sortOrder: true,
      },
    });
  }

  async listTags(): Promise<readonly StoryTaxonomyTagRecord[]> {
    return this.prisma.tag.findMany({
      orderBy: {
        name: 'asc',
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });
  }

  private toRecord(story: StoryRow): StoryRecord {
    const categories = story.categories
      .map(({ category, isPrimary }) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        isPrimary,
      }))
      .sort((left, right) => {
        if (left.isPrimary !== right.isPrimary) {
          return left.isPrimary ? -1 : 1;
        }

        return left.name.localeCompare(right.name);
      });

    const tags = story.tags
      .map(({ tag }) => ({
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
      }))
      .sort((left, right) => left.name.localeCompare(right.name));

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
      coverMediaId: story.coverMediaId,
      categories,
      tags,
      version: story.version,
      createdAt: story.createdAt,
      updatedAt: story.updatedAt,
    };
  }
}

type TaxonomyValidationResult =
  | {
      readonly status: 'valid';
    }
  | {
      readonly status: 'invalid_categories';

      readonly invalidIds: readonly string[];
    }
  | {
      readonly status: 'invalid_tags';

      readonly invalidIds: readonly string[];
    };

async function validateTaxonomy(
  tx: Prisma.TransactionClient,
  categoryIds: readonly string[] | undefined,
  tagIds: readonly string[] | undefined,
): Promise<TaxonomyValidationResult> {
  if (categoryIds !== undefined && categoryIds.length > 0) {
    const categories = await tx.category.findMany({
      where: {
        id: {
          in: [...categoryIds],
        },
        isActive: true,
      },
      select: {
        id: true,
      },
    });
    const validIds = new Set(categories.map(({ id }) => id));
    const invalidIds = categoryIds.filter((id) => !validIds.has(id));

    if (invalidIds.length > 0) {
      return {
        status: 'invalid_categories',
        invalidIds,
      };
    }
  }

  if (tagIds !== undefined && tagIds.length > 0) {
    const tags = await tx.tag.findMany({
      where: {
        id: {
          in: [...tagIds],
        },
      },
      select: {
        id: true,
      },
    });
    const validIds = new Set(tags.map(({ id }) => id));
    const invalidIds = tagIds.filter((id) => !validIds.has(id));

    if (invalidIds.length > 0) {
      return {
        status: 'invalid_tags',
        invalidIds,
      };
    }
  }

  return {
    status: 'valid',
  };
}

function hasCategoryChanges(
  current: StoryRow,
  nextIds: readonly string[] | undefined,
): boolean {
  if (nextIds === undefined) {
    return false;
  }

  const currentIds = current.categories.map(({ category }) => category.id);

  return (
    !sameIdSet(currentIds, nextIds) ||
    getPrimaryCategoryId(current) !== (nextIds[0] ?? null)
  );
}

function hasTagChanges(
  current: StoryRow,
  nextIds: readonly string[] | undefined,
): boolean {
  if (nextIds === undefined) {
    return false;
  }

  return !sameIdSet(
    current.tags.map(({ tag }) => tag.id),
    nextIds,
  );
}

function sameIdSet(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const rightSet = new Set(right);

  return left.every((id) => rightSet.has(id));
}

function getPrimaryCategoryId(story: StoryRow): string | null {
  return (
    story.categories.find(({ isPrimary }) => isPrimary)?.category.id ?? null
  );
}

async function validateAndLockStoryCover(
  tx: Prisma.TransactionClient,
  mediaAssetId: string,
  userId: string,
  storyId: string,
): Promise<boolean> {
  const locked = await lockMediaAssetRow(tx, mediaAssetId);

  if (!locked) {
    return false;
  }

  const media = await tx.mediaAsset.findFirst({
    where: {
      id: mediaAssetId,
      uploaderId: userId,
      purpose: MediaPurpose.STORY_COVER,
      status: MediaStatus.READY,
      resourceType: MediaResourceType.IMAGE,
      deletedAt: null,
    },
    select: {
      metadata: true,
    },
  });

  return Boolean(media && readMediaOwnerId(media.metadata) === storyId);
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

async function lockMediaAssetRow(
  tx: Prisma.TransactionClient,
  mediaAssetId: string,
): Promise<boolean> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "media_assets"
    WHERE "id" = ${mediaAssetId}::uuid
    FOR UPDATE
  `);

  return rows.length === 1;
}

function readMediaOwnerId(metadata: Prisma.JsonValue | null): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }

  const value = (metadata as Record<string, unknown>)['ownerId'];

  return typeof value === 'string' ? value : null;
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
