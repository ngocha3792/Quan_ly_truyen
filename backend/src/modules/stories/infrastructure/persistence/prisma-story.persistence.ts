import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import {
  ChapterStatus,
  MediaPurpose,
  MediaResourceType,
  MediaStatus,
  Prisma,
  ModerationActionType,
  SubmissionStatus,
  StoryStatus,
  StoryVisibility,
} from '@/generated/prisma/client';
import { createUniqueSlug, slugify } from '@/common/utils';
import { mapPrismaError, PrismaService } from '@/infrastructure/database';

import type {
  CancelAuthorStorySubmissionInput,
  ListPublicStoriesInput,
  CancelAuthorStorySubmissionResult,
  CreateAuthorStoryInput,
  CreateAuthorStoryResult,
  DeleteAuthorStoryInput,
  DeleteAuthorStoryResult,
  ReviewStorySubmissionInput,
  ReviewStorySubmissionResult,
  PublicStoryDto,
  PublicStoryPageDto,
  StoryPersistencePort,
  StoryPublicationRecord,
  StoryRecord,
  StoryTaxonomyCategoryRecord,
  StoryTaxonomyTagRecord,
  SubmitAuthorStoryInput,
  SubmitAuthorStoryResult,
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
  publishedAt: true,
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

const PUBLIC_STORY_SELECT = {
  id: true,
  title: true,
  slug: true,
  synopsis: true,
  languageCode: true,
  contentRating: true,
  releaseYear: true,
  status: true,
  publishedAt: true,
  lastChapterAt: true,
  viewCount: true,
  followerCount: true,
  ratingCount: true,
  ratingAverage: true,
  chapterCount: true,
  commentCount: true,
  updatedAt: true,
  author: {
    select: {
      userId: true,
      penName: true,
      slug: true,
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
      category: {
        isActive: true,
      },
    },
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
  chapters: {
    where: {
      status: ChapterStatus.PUBLISHED,
      deletedAt: null,
    },
    orderBy: {
      number: 'desc',
    },
    take: 1,
    select: {
      id: true,
      number: true,
      title: true,
      slug: true,
      publishedAt: true,
    },
  },
} satisfies Prisma.StorySelect;

type PublicStoryRow = Prisma.StoryGetPayload<{
  select: typeof PUBLIC_STORY_SELECT;
}>;

const PUBLIC_STORY_STATUSES = [
  StoryStatus.PUBLISHED,
  StoryStatus.HIATUS,
  StoryStatus.COMPLETED,
] as const;

@Injectable()
export class PrismaStoryPersistence implements StoryPersistencePort {
  constructor(private readonly prisma: PrismaService) { }

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

          if (![StoryStatus.DRAFT, StoryStatus.REJECTED].includes(current.status)) {
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
              ...(current.status === StoryStatus.REJECTED
                ? {
                  status: StoryStatus.DRAFT,
                  visibility: StoryVisibility.PRIVATE,
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

        if (![StoryStatus.DRAFT, StoryStatus.REJECTED].includes(current.status)) {
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

  async submitForReview(
    input: SubmitAuthorStoryInput,
  ): Promise<SubmitAuthorStoryResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (!(await lockStoryRow(tx, input.storyId))) {
          return { status: 'not_found' };
        }
        const story = await tx.story.findFirst({
          where: { id: input.storyId, authorId: input.userId, deletedAt: null },
          select: STORY_SELECT,
        });
        if (!story) {
          return { status: 'not_found' };
        }
        if (![StoryStatus.DRAFT, StoryStatus.REJECTED].includes(story.status)) {
          return { status: 'not_draft' };
        }

        const pending = await tx.storySubmission.findFirst({
          where: { storyId: story.id, status: SubmissionStatus.PENDING },
          select: { id: true },
        });
        if (pending) {
          return { status: 'already_pending' };
        }

        const missing = await getStoryPublicationMissing(
          tx,
          story,
          input.userId,
        );
        if (missing.length > 0) {
          return { status: 'not_ready', missing };
        }

        const submission = await tx.storySubmission.create({
          data: {
            storyId: story.id,
            submittedById: input.userId,
            status: SubmissionStatus.PENDING,
            authorNote: input.authorNote,
            submittedAt: input.submittedAt,
          },
        });
        const updated = await tx.story.update({
          where: { id: story.id },
          data: {
            status: StoryStatus.PENDING_REVIEW,
            visibility: StoryVisibility.PRIVATE,
            updatedAt: input.submittedAt,
            version: { increment: 1 },
          },
          select: STORY_SELECT,
        });
        await tx.auditLog.create({
          data: {
            actorId: input.userId,
            action: 'story.submitted',
            entityType: 'story',
            entityId: story.id,
            oldValues: { status: story.status, version: story.version },
            newValues: {
              status: updated.status,
              submissionId: submission.id,
              version: updated.version,
            },
            ipAddress: input.audit.ipAddress,
            userAgent: input.audit.userAgent,
            requestId: input.audit.requestId,
            createdAt: input.submittedAt,
          },
        });
        return {
          status: 'submitted',
          publication: this.toPublication(updated, submission),
        };
      });
    } catch (error: unknown) {
      if (isUniqueConstraintViolation(error)) {
        return { status: 'already_pending' };
      }
      throw mapPrismaError(error, {
        operation: 'story-submit',
        resource: 'Truyện',
      });
    }
  }

  async cancelSubmission(
    input: CancelAuthorStorySubmissionInput,
  ): Promise<CancelAuthorStorySubmissionResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (!(await lockStoryRow(tx, input.storyId))) {
          return { status: 'not_found' };
        }
        const story = await tx.story.findFirst({
          where: { id: input.storyId, authorId: input.userId, deletedAt: null },
          select: STORY_SELECT,
        });
        if (!story) {
          return { status: 'not_found' };
        }
        const pending = await tx.storySubmission.findFirst({
          where: { storyId: story.id, status: SubmissionStatus.PENDING },
        });
        if (!pending || story.status !== StoryStatus.PENDING_REVIEW) {
          return { status: 'not_pending' };
        }
        await lockSubmissionRow(tx, pending.id);
        const submission = await tx.storySubmission.update({
          where: { id: pending.id },
          data: {
            status: SubmissionStatus.CANCELED,
            canceledAt: input.canceledAt,
          },
        });
        const updated = await tx.story.update({
          where: { id: story.id },
          data: {
            status: StoryStatus.DRAFT,
            visibility: StoryVisibility.PRIVATE,
            updatedAt: input.canceledAt,
            version: { increment: 1 },
          },
          select: STORY_SELECT,
        });
        await tx.auditLog.create({
          data: {
            actorId: input.userId,
            action: 'story.submission.canceled',
            entityType: 'story',
            entityId: story.id,
            oldValues: { status: story.status, submissionId: pending.id },
            newValues: {
              status: updated.status,
              submissionStatus: submission.status,
            },
            ipAddress: input.audit.ipAddress,
            userAgent: input.audit.userAgent,
            requestId: input.audit.requestId,
            createdAt: input.canceledAt,
          },
        });
        return {
          status: 'canceled',
          publication: this.toPublication(updated, submission),
        };
      });
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'story-submission-cancel',
        resource: 'Truyện',
      });
    }
  }

  async approveSubmission(
    input: ReviewStorySubmissionInput,
  ): Promise<ReviewStorySubmissionResult> {
    return this.reviewSubmission(input, true);
  }

  async rejectSubmission(
    input: ReviewStorySubmissionInput,
  ): Promise<ReviewStorySubmissionResult> {
    return this.reviewSubmission(input, false);
  }

  private async reviewSubmission(
    input: ReviewStorySubmissionInput,
    approve: boolean,
  ): Promise<ReviewStorySubmissionResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const initial = await tx.storySubmission.findUnique({
          where: { id: input.submissionId },
          select: { storyId: true },
        });
        if (!initial) {
          return { status: 'not_found' };
        }
        if (!(await lockStoryRow(tx, initial.storyId))) {
          return { status: 'not_found' };
        }
        if (!(await lockSubmissionRow(tx, input.submissionId))) {
          return { status: 'not_found' };
        }
        const submission = await tx.storySubmission.findUnique({
          where: { id: input.submissionId },
        });
        if (!submission) {
          return { status: 'not_found' };
        }
        if (submission.status !== SubmissionStatus.PENDING) {
          return { status: 'not_pending' };
        }
        if (submission.submittedById === input.reviewerId) {
          return { status: 'self_review' };
        }
        const story = await tx.story.findFirst({
          where: { id: submission.storyId, deletedAt: null },
          select: STORY_SELECT,
        });
        if (!story || story.status !== StoryStatus.PENDING_REVIEW) {
          return { status: 'not_pending' };
        }

        if (approve) {
          const missing = await getStoryPublicationMissing(
            tx,
            story,
            story.authorId,
          );
          if (missing.length > 0) {
            return { status: 'not_ready', missing };
          }
        }

        const nextSubmissionStatus = approve
          ? SubmissionStatus.APPROVED
          : SubmissionStatus.REJECTED;
        const nextStoryStatus = approve
          ? StoryStatus.PUBLISHED
          : StoryStatus.REJECTED;
        const nextVisibility = approve
          ? StoryVisibility.PUBLIC
          : StoryVisibility.PRIVATE;
        const reviewed = await tx.storySubmission.update({
          where: { id: submission.id },
          data: {
            status: nextSubmissionStatus,
            reviewedById: input.reviewerId,
            reviewerNote: input.reviewerNote,
            reviewedAt: input.reviewedAt,
          },
        });
        const updated = await tx.story.update({
          where: { id: story.id },
          data: {
            status: nextStoryStatus,
            visibility: nextVisibility,
            ...(approve ? { publishedAt: input.reviewedAt } : {}),
            updatedAt: input.reviewedAt,
            version: { increment: 1 },
          },
          select: STORY_SELECT,
        });
        await tx.moderationAction.create({
          data: {
            actorId: input.reviewerId,
            submissionId: submission.id,
            storyId: story.id,
            action: approve
              ? ModerationActionType.APPROVE_STORY
              : ModerationActionType.REJECT_STORY,
            reason: input.reviewerNote,
            createdAt: input.reviewedAt,
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: input.reviewerId,
            action: approve ? 'story.published' : 'story.rejected',
            entityType: 'story',
            entityId: story.id,
            oldValues: {
              status: story.status,
              visibility: story.visibility,
              submissionId: submission.id,
            },
            newValues: {
              status: updated.status,
              visibility: updated.visibility,
              submissionStatus: reviewed.status,
              publishedAt: approve ? input.reviewedAt.toISOString() : null,
            },
            ipAddress: input.audit.ipAddress,
            userAgent: input.audit.userAgent,
            requestId: input.audit.requestId,
            createdAt: input.reviewedAt,
          },
        });
        return {
          status: approve ? 'approved' : 'rejected',
          publication: this.toPublication(updated, reviewed),
        };
      });
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: approve
          ? 'story-submission-approve'
          : 'story-submission-reject',
        resource: 'Truyện',
      });
    }
  }

  private toPublication(
    story: StoryRow,
    submission: {
      id: string;
      storyId: string;
      submittedById: string;
      reviewedById: string | null;
      status: SubmissionStatus;
      authorNote: string | null;
      reviewerNote: string | null;
      submittedAt: Date;
      reviewedAt: Date | null;
      canceledAt: Date | null;
    },
  ): StoryPublicationRecord {
    return {
      story: this.toRecord(story),
      submission: {
        id: submission.id,
        storyId: submission.storyId,
        submittedById: submission.submittedById,
        reviewedById: submission.reviewedById,
        status: submission.status,
        authorNote: submission.authorNote,
        reviewerNote: submission.reviewerNote,
        submittedAt: submission.submittedAt,
        reviewedAt: submission.reviewedAt,
        canceledAt: submission.canceledAt,
      },
    };
  }

  async listPublic(input: ListPublicStoriesInput): Promise<PublicStoryPageDto> {
    const where = buildPublicStoryWhere(input);
    const skip = (input.page - 1) * input.pageSize;

    try {
      const [totalItems, stories] = await this.prisma.$transaction([
        this.prisma.story.count({ where }),
        this.prisma.story.findMany({
          where,
          orderBy: buildPublicStoryOrderBy(input.sort),
          skip,
          take: input.pageSize,
          select: PUBLIC_STORY_SELECT,
        }),
      ]);

      return {
        items: stories.map((story) => toPublicStoryDto(story)),
        pagination: {
          page: input.page,
          pageSize: input.pageSize,
          totalItems,
          totalPages:
            totalItems === 0 ? 0 : Math.ceil(totalItems / input.pageSize),
        },
      };
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'public-story-list',
        resource: 'Truyện',
      });
    }
  }

  async findPublicBySlug(slug: string): Promise<PublicStoryDto | null> {
    try {
      const story = await this.prisma.story.findFirst({
        where: {
          slug,
          deletedAt: null,
          visibility: StoryVisibility.PUBLIC,
          status: {
            in: [...PUBLIC_STORY_STATUSES],
          },
        },
        select: PUBLIC_STORY_SELECT,
      });

      return story ? toPublicStoryDto(story) : null;
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'public-story-detail',
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
      publishedAt: story.publishedAt,
      categories,
      tags,
      version: story.version,
      createdAt: story.createdAt,
      updatedAt: story.updatedAt,
    };
  }
}

async function getStoryPublicationMissing(
  tx: Prisma.TransactionClient,
  story: StoryRow,
  authorUserId: string,
): Promise<readonly string[]> {
  const missing: string[] = [];

  if (!story.synopsis.trim()) missing.push('synopsis');

  if (!story.coverMediaId) {
    missing.push('cover');
  } else {
    const validCover = await validateAndLockStoryCover(
      tx,
      story.coverMediaId,
      authorUserId,
      story.id,
    );
    if (!validCover) missing.push('cover');
  }

  const activeCategory = await tx.storyCategory.findFirst({
    where: {
      storyId: story.id,
      category: { isActive: true },
    },
    select: { categoryId: true },
  });
  if (!activeCategory) missing.push('category');

  const chapterRows = await tx.$queryRaw<Array<{ id: string; }>>(Prisma.sql`
    SELECT "id" FROM "chapters"
    WHERE "story_id" = ${story.id}::uuid
      AND "deleted_at" IS NULL
      AND length(btrim("content")) > 0
    LIMIT 1
  `);
  if (chapterRows.length === 0) missing.push('chapter');

  return missing;
}

async function lockSubmissionRow(
  tx: Prisma.TransactionClient,
  submissionId: string,
): Promise<boolean> {
  const rows = await tx.$queryRaw<Array<{ id: string; }>>(Prisma.sql`
    SELECT "id" FROM "story_submissions"
    WHERE "id" = ${submissionId}::uuid
    FOR UPDATE
  `);
  return rows.length === 1;
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
  const rows = await tx.$queryRaw<Array<{ id: string; }>>(Prisma.sql`
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
  const rows = await tx.$queryRaw<Array<{ id: string; }>>(Prisma.sql`
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

function buildPublicStoryWhere(
  input: ListPublicStoriesInput,
): Prisma.StoryWhereInput {
  const requestedStatus = input.status
    ? mapPublicListStatusToStoryStatus(input.status)
    : undefined;

  return {
    deletedAt: null,
    visibility: StoryVisibility.PUBLIC,
    status: requestedStatus
      ? requestedStatus
      : {
          in: [...PUBLIC_STORY_STATUSES],
        },
    ...(input.q
      ? {
          OR: [
            {
              title: {
                contains: input.q,
                mode: 'insensitive',
              },
            },
            {
              synopsis: {
                contains: input.q,
                mode: 'insensitive',
              },
            },
            {
              author: {
                penName: {
                  contains: input.q,
                  mode: 'insensitive',
                },
              },
            },
            {
              tags: {
                some: {
                  tag: {
                    name: {
                      contains: input.q,
                      mode: 'insensitive',
                    },
                  },
                },
              },
            },
          ],
        }
      : {}),
    ...(input.genre
      ? {
          categories: {
            some: {
              category: {
                slug: input.genre,
                isActive: true,
              },
            },
          },
        }
      : {}),
    ...(input.yearFrom !== undefined || input.yearTo !== undefined
      ? {
          releaseYear: {
            ...(input.yearFrom !== undefined ? { gte: input.yearFrom } : {}),
            ...(input.yearTo !== undefined ? { lte: input.yearTo } : {}),
          },
        }
      : {}),
  };
}

function buildPublicStoryOrderBy(
  sort: ListPublicStoriesInput['sort'],
): Prisma.StoryOrderByWithRelationInput[] {
  switch (sort) {
    case 'popular':
      return [{ viewCount: 'desc' }, { publishedAt: 'desc' }, { id: 'desc' }];
    case 'rating':
      return [
        { ratingAverage: 'desc' },
        { ratingCount: 'desc' },
        { publishedAt: 'desc' },
        { id: 'desc' },
      ];
    case 'chapter-count':
      return [
        { chapterCount: 'desc' },
        { updatedAt: 'desc' },
        { id: 'desc' },
      ];
    case 'oldest':
      return [{ publishedAt: 'asc' }, { id: 'asc' }];
    case 'latest':
    default:
      return [{ updatedAt: 'desc' }, { id: 'desc' }];
  }
}

function mapPublicListStatusToStoryStatus(
  status: NonNullable<ListPublicStoriesInput['status']>,
): StoryStatus {
  switch (status) {
    case 'completed':
      return StoryStatus.COMPLETED;
    case 'hiatus':
      return StoryStatus.HIATUS;
    case 'ongoing':
    default:
      return StoryStatus.PUBLISHED;
  }
}

function toPublicStoryDto(story: PublicStoryRow): PublicStoryDto {
  const latest = story.chapters[0];
  const latestChapter =
    latest?.publishedAt != null
      ? {
          id: latest.id,
          number: Number(latest.number),
          title: latest.title,
          slug: latest.slug,
          publishedAt: latest.publishedAt,
        }
      : null;

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
    slug: story.slug,
    title: story.title,
    synopsis: story.synopsis,
    languageCode: story.languageCode,
    contentRating: story.contentRating,
    releaseYear: story.releaseYear,
    status: toPublicPublicationStatus(story.status),
    author: {
      id: story.author.userId,
      penName: story.author.penName,
      slug: story.author.slug,
    },
    coverUrl: getPublicStoryCoverUrl(story),
    categories,
    tags,
    latestChapter,
    stats: {
      views: bigintToSafeNumber(story.viewCount),
      followers: story.followerCount,
      ratingCount: story.ratingCount,
      ratingAverage: Number(story.ratingAverage),
      chapters: story.chapterCount,
      comments: story.commentCount,
    },
    publishedAt: story.publishedAt,
    lastChapterAt: story.lastChapterAt,
    updatedAt: story.updatedAt,
  };
}

function toPublicPublicationStatus(
  status: StoryStatus,
): PublicStoryDto['status'] {
  if (status === StoryStatus.COMPLETED) {
    return 'COMPLETED';
  }
  if (status === StoryStatus.HIATUS) {
    return 'HIATUS';
  }
  return 'ONGOING';
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


function getPublicStoryCoverUrl(story: PublicStoryRow): string | null {
  const cover = story.coverMedia;

  if (
    !cover ||
    cover.deletedAt !== null ||
    cover.purpose !== MediaPurpose.STORY_COVER ||
    cover.status !== MediaStatus.READY ||
    cover.resourceType !== MediaResourceType.IMAGE
  ) {
    return null;
  }

  return cover.secureUrl ?? cover.publicUrl ?? null;
}
