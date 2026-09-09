import { randomUUID } from 'node:crypto';
import { workflowSnapshot } from './chapter-workflow.mapper';
import { ChapterWorkflowPolicy } from '../../domain/policies/chapter-workflow.policy';

import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

import {
  ChapterAccessType,
  ChapterEntitlementStatus,
  ChapterStatus,
  ContentFormat,
  Prisma,
  StoryStatus,
  StoryVisibility,
} from '@/generated/prisma/client';
import { slugify } from '@/common/utils';
import {
  monetizationConfig,
  readerFeaturesConfig,
  shouldEnforceChapterPaywall,
} from '@/config';
import type { ReaderFeaturesConfig } from '@/config';
import { mapPrismaError, PrismaService } from '@/infrastructure/database';
import { MEDIA_URL_BUILDER, type MediaUrlPort } from '@/modules/media';
import {
  editableStoryWhere,
  lockAndFindEditableStory,
} from './chapter-edit-access';

import type {
  ChapterPersistencePort,
  ChapterRecord,
  ChapterSummaryRecord,
  ChapterVersionPageRecord,
  ChapterVersionRecord,
  PublicChapterReaderDto,
  PublicStoryChapterListDto,
  PublicStoryChapterListItemDto,
  CreateAuthorChapterInput,
  CreateAuthorChapterResult,
  CancelAuthorChapterScheduleInput,
  CancelAuthorChapterScheduleResult,
  DeleteAuthorChapterInput,
  DeleteAuthorChapterResult,
  FindAuthorChapterVersionInput,
  ListAuthorChapterVersionsInput,
  PublishDueScheduledChaptersInput,
  PublishAuthorChapterInput,
  PublishAuthorChapterResult,
  RestoreAuthorChapterVersionInput,
  RestoreAuthorChapterVersionResult,
  ScheduleAuthorChapterInput,
  ScheduleAuthorChapterResult,
  UpdateAuthorChapterInput,
  UpdateAuthorChapterResult,
} from '../../application';
import {
  ChapterDraftPolicy,
  createBackfilledChapterContentDocument,
  createChapterContentDocument,
  isChapterContentDocument,
  type ChapterContentDocument,
} from '../../domain';

const CHAPTER_SELECT = {
  id: true,
  storyId: true,
  createdById: true,
  updatedById: true,
  number: true,
  title: true,
  slug: true,
  content: true,
  contentDocument: true,
  documentSchemaVersion: true,
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

const CHAPTER_VERSION_SUMMARY_SELECT = {
  versionType: true,
  isRetained: true,
  expiresAt: true,
  id: true,
  chapterId: true,
  createdById: true,
  version: true,
  title: true,
  wordCount: true,
  changeSummary: true,
  createdAt: true,
  createdBy: {
    select: {
      displayName: true,
    },
  },
} satisfies Prisma.ChapterVersionSelect;

const CHAPTER_VERSION_SELECT = {
  ...CHAPTER_VERSION_SUMMARY_SELECT,
  content: true,
  contentDocument: true,
  documentSchemaVersion: true,
  contentFormat: true,
} satisfies Prisma.ChapterVersionSelect;

type ChapterVersionRow = Prisma.ChapterVersionGetPayload<{
  select: typeof CHAPTER_VERSION_SELECT;
}>;

const PUBLIC_CHAPTER_READER_METADATA_SELECT = {
  id: true,
  storyId: true,
  number: true,
  title: true,
  slug: true,
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
      authorId: true,
    },
  },
  monetization: {
    select: {
      accessType: true,
      creditPrice: true,
      previewContent: true,
      unlockPolicy: true,
      freeAt: true,
      paidWindowDays: true,
    },
  },
} satisfies Prisma.ChapterSelect;

type PublicChapterReaderMetadataRow = Prisma.ChapterGetPayload<{
  select: typeof PUBLIC_CHAPTER_READER_METADATA_SELECT;
}>;

const PUBLIC_CHAPTER_CONTENT_SELECT = {
  content: true,
  contentDocument: true,
  documentSchemaVersion: true,
  contentFormat: true,
  media: {
    orderBy: { sortOrder: 'asc' },
    select: {
      mediaAssetId: true,
      sortOrder: true,
      altText: true,
      caption: true,
      mediaAsset: {
        select: {
          publicId: true,
          width: true,
          height: true,
          deliveryType: true,
        },
      },
      slices: {
        where: { processingStatus: 'READY' },
        orderBy: { sliceIndex: 'asc' },
        select: {
          id: true,
          sliceIndex: true,
          width: true,
          height: true,
          offsetY: true,
          aspectRatio: true,
        },
      },
    },
  },
} satisfies Prisma.ChapterSelect;

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
  constructor(
    private readonly prisma: PrismaService,
    @Inject(monetizationConfig.KEY)
    private readonly monetization: ConfigType<typeof monetizationConfig>,
    @Inject(readerFeaturesConfig.KEY)
    private readonly readerFeatures: ReaderFeaturesConfig,
    @Inject(MEDIA_URL_BUILDER)
    private readonly mediaUrl: MediaUrlPort,
  ) {}

  async listOwnedByStory(
    userId: string,
    storyId: string,
  ): Promise<readonly ChapterSummaryRecord[] | null> {
    try {
      const story = await this.prisma.story.findFirst({
        where: {
          id: storyId,
          ...editableStoryWhere(userId),
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
          story: editableStoryWhere(userId),
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

  async listOwnedVersions(
    input: ListAuthorChapterVersionsInput,
  ): Promise<ChapterVersionPageRecord | null> {
    try {
      const chapter = await this.prisma.chapter.findFirst({
        where: {
          id: input.chapterId,
          storyId: input.storyId,
          deletedAt: null,
          story: editableStoryWhere(input.userId),
        },
        select: { id: true },
      });

      if (!chapter) return null;

      const where: Prisma.ChapterVersionWhereInput = {
        chapterId: chapter.id,
        ...(input.includeAutosaves ? {} : { versionType: { not: 'AUTOSAVE' } }),
      };
      const [total, versions] = await this.prisma.$transaction([
        this.prisma.chapterVersion.count({
          where,
        }),
        this.prisma.chapterVersion.findMany({
          where,
          orderBy: [{ version: 'desc' }, { id: 'desc' }],
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          select: CHAPTER_VERSION_SUMMARY_SELECT,
        }),
      ]);

      return {
        items: versions.map((version) => ({
          versionType: version.versionType,
          isRetained: version.isRetained,
          expiresAt: version.expiresAt,
          id: version.id,
          chapterId: version.chapterId,
          createdById: version.createdById,
          createdByDisplayName: version.createdBy.displayName,
          version: version.version,
          title: version.title,
          wordCount: version.wordCount,
          changeSummary: version.changeSummary,
          createdAt: version.createdAt,
        })),
        total,
        page: input.page,
        pageSize: input.pageSize,
      };
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'author-chapter-version-list',
        resource: 'Lịch sử chương',
      });
    }
  }

  async findOwnedVersion(
    input: FindAuthorChapterVersionInput,
  ): Promise<ChapterVersionRecord | null> {
    try {
      const version = await this.prisma.chapterVersion.findFirst({
        where: {
          chapterId: input.chapterId,
          version: input.version,
          chapter: {
            storyId: input.storyId,
            deletedAt: null,
            story: editableStoryWhere(input.userId),
          },
        },
        select: CHAPTER_VERSION_SELECT,
      });

      return version ? toChapterVersionRecord(version) : null;
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'author-chapter-version-detail',
        resource: 'Phiên bản chương',
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
        const contentDocument = createChapterContentDocument(input.content);

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
            contentDocument: toPrismaJson(contentDocument),
            documentSchemaVersion: contentDocument.schemaVersion,
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
                contentDocument: toPrismaJson(contentDocument),
                documentSchemaVersion: contentDocument.schemaVersion,
                contentFormat: ContentFormat.MARKDOWN,
                wordCount: input.wordCount,
                changeSummary: 'Tạo bản nháp',
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
        const story = await lockAndFindEditableStory(
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

        if (
          input.expectedVersion !== undefined &&
          current.version !== input.expectedVersion
        ) {
          return {
            status: 'version_conflict',
            currentVersion: current.version,
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
          // A manual save makes the current autosave a durable checkpoint,
          // without manufacturing another identical content version.
          if (input.saveType !== 'AUTOSAVE') {
            await tx.chapterVersion.updateMany({
              where: {
                chapterId: current.id,
                version: current.version,
                versionType: 'AUTOSAVE',
              },
              data: {
                versionType: 'MANUAL_SAVE',
                isRetained: true,
                expiresAt: null,
              },
            });
          }
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
        const currentDocument = toContentDocument(
          current.contentDocument,
          current.content,
          current.id,
        );
        const nextDocument = contentChanged
          ? createChapterContentDocument(nextContent, currentDocument)
          : currentDocument;

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
            contentDocument: toPrismaJson(nextDocument),
            documentSchemaVersion: nextDocument.schemaVersion,
            updatedById: input.userId,
            updatedAt: input.updatedAt,
            version: nextVersion,
            versions: {
              create: {
                createdById: input.userId,
                version: nextVersion,
                title: nextTitle,
                content: nextContent,
                contentDocument: toPrismaJson(nextDocument),
                documentSchemaVersion: nextDocument.schemaVersion,
                contentFormat: current.contentFormat,
                wordCount: nextWordCount,
                changeSummary: describeChapterChanges(
                  titleChanged,
                  contentChanged,
                ),
                createdAt: input.updatedAt,
                versionType: input.saveType ?? 'MANUAL_SAVE',
                isRetained: input.saveType !== 'AUTOSAVE',
                expiresAt:
                  input.saveType === 'AUTOSAVE'
                    ? new Date(
                        input.updatedAt.getTime() + 7 * 24 * 60 * 60 * 1000,
                      )
                    : null,
              },
            },
          },
          select: CHAPTER_SELECT,
        });

        await tx.auditLog.create({
          data: {
            actorId: input.userId,
            action:
              input.saveType === 'AUTOSAVE'
                ? 'chapter.draft.autosaved'
                : 'chapter.draft.updated',
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

  async restoreDraftVersion(
    input: RestoreAuthorChapterVersionInput,
  ): Promise<RestoreAuthorChapterVersionResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const story = await lockAndFindEditableStory(
          tx,
          input.storyId,
          input.userId,
        );

        if (!story) return { status: 'not_found' };
        if (story.status === StoryStatus.PENDING_REVIEW) {
          return { status: 'story_pending_review' };
        }

        const chapterLocked = await lockChapterRowForStory(
          tx,
          input.chapterId,
          story.id,
        );
        if (!chapterLocked) return { status: 'not_found' };

        const current = await tx.chapter.findFirst({
          where: {
            id: input.chapterId,
            storyId: story.id,
            deletedAt: null,
          },
          select: CHAPTER_SELECT,
        });
        if (!current) return { status: 'not_found' };
        if (
          input.expectedVersion !== undefined &&
          input.expectedVersion !== current.version
        ) {
          return {
            status: 'version_conflict',
            currentVersion: current.version,
          };
        }
        if (current.status !== ChapterStatus.DRAFT) {
          return { status: 'not_draft' };
        }

        const source = await tx.chapterVersion.findUnique({
          where: {
            chapterId_version: {
              chapterId: current.id,
              version: input.version,
            },
          },
          select: {
            version: true,
            title: true,
            content: true,
            contentDocument: true,
            documentSchemaVersion: true,
            contentFormat: true,
            wordCount: true,
          },
        });
        if (!source) return { status: 'version_not_found' };
        const sourceDocument = toContentDocument(
          source.contentDocument,
          source.content,
          current.id,
        );
        const nextVersion = current.version + 1;
        const updated = await tx.chapter.update({
          where: { id: current.id },
          data: {
            title: source.title,
            slug: createChapterSlug(current.number.toNumber(), source.title),
            content: source.content,
            contentDocument: toPrismaJson(sourceDocument),
            documentSchemaVersion: sourceDocument.schemaVersion,
            contentFormat: source.contentFormat,
            wordCount: source.wordCount,
            updatedById: input.userId,
            updatedAt: input.restoredAt,
            version: nextVersion,
            versions: {
              create: {
                createdById: input.userId,
                version: nextVersion,
                title: source.title,
                content: source.content,
                contentDocument: toPrismaJson(sourceDocument),
                documentSchemaVersion: sourceDocument.schemaVersion,
                contentFormat: source.contentFormat,
                wordCount: source.wordCount,
                changeSummary: `Khôi phục từ phiên bản ${source.version}`,
                versionType: 'MANUAL_SAVE',
                isRetained: true,
                expiresAt: null,
                createdAt: input.restoredAt,
              },
            },
          },
          select: CHAPTER_SELECT,
        });

        await tx.auditLog.create({
          data: {
            actorId: input.userId,
            action: 'chapter.version.restored',
            entityType: 'chapter',
            entityId: current.id,
            oldValues: {
              title: current.title,
              contentLength: current.content.length,
              wordCount: current.wordCount,
              version: current.version,
            },
            newValues: {
              title: updated.title,
              contentLength: updated.content.length,
              wordCount: updated.wordCount,
              version: updated.version,
              restoredFromVersion: source.version,
            },
            ipAddress: input.audit.ipAddress,
            userAgent: input.audit.userAgent,
            requestId: input.audit.requestId,
            createdAt: input.restoredAt,
          },
        });

        return { status: 'restored', chapter: this.toRecord(updated) };
      });
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'chapter-version-restore',
        resource: 'Phiên bản chương',
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
        if (!ChapterWorkflowPolicy.canPublish(current.status)) {
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
            version: { increment: 1 },
            versions: {
              create: {
                ...workflowSnapshot(
                  current,
                  input.userId,
                  current.version + 1,
                  'Xuất bản chương',
                ),
                versionType: 'PUBLISHED',
              },
            },
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
        await createChapterPublishedOutboxEvents(tx, {
          story,
          chapter: updated,
          publishedAt: input.publishedAt,
          requestId: input.audit.requestId,
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

  async schedule(
    input: ScheduleAuthorChapterInput,
  ): Promise<ScheduleAuthorChapterResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const storyLocked = await lockOwnedStoryRow(
          tx,
          input.storyId,
          input.userId,
        );
        if (!storyLocked) return { status: 'not_found' };

        const story = await tx.story.findFirst({
          where: { id: input.storyId, authorId: input.userId, deletedAt: null },
          select: { id: true, status: true },
        });
        if (!story) return { status: 'not_found' };
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
        if (!current) return { status: 'not_found' };
        if (!ChapterWorkflowPolicy.canPublish(current.status)) {
          return { status: 'not_schedulable' };
        }
        if (!current.content.trim()) return { status: 'empty_content' };

        const updated = await tx.chapter.update({
          where: { id: current.id },
          data: {
            status: ChapterStatus.SCHEDULED,
            scheduledAt: input.scheduledAt,
            version: { increment: 1 },
            versions: {
              create: workflowSnapshot(
                current,
                input.userId,
                current.version + 1,
                'Lên lịch xuất bản',
              ),
            },
            publishedAt: null,
            updatedById: input.userId,
            updatedAt: input.updatedAt,
          },
          select: CHAPTER_SELECT,
        });

        await tx.auditLog.create({
          data: {
            actorId: input.userId,
            action:
              current.status === ChapterStatus.SCHEDULED
                ? 'chapter.rescheduled'
                : 'chapter.scheduled',
            entityType: 'chapter',
            entityId: current.id,
            oldValues: {
              storyId: current.storyId,
              status: current.status,
              scheduledAt: current.scheduledAt?.toISOString() ?? null,
            },
            newValues: {
              storyId: updated.storyId,
              status: updated.status,
              scheduledAt: updated.scheduledAt?.toISOString() ?? null,
            },
            ipAddress: input.audit.ipAddress,
            userAgent: input.audit.userAgent,
            requestId: input.audit.requestId,
            createdAt: input.updatedAt,
          },
        });

        return { status: 'scheduled', chapter: this.toRecord(updated) };
      });
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'chapter-schedule',
        resource: 'Chương',
      });
    }
  }

  async cancelSchedule(
    input: CancelAuthorChapterScheduleInput,
  ): Promise<CancelAuthorChapterScheduleResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const storyLocked = await lockOwnedStoryRow(
          tx,
          input.storyId,
          input.userId,
        );
        if (!storyLocked) return { status: 'not_found' };
        if (
          !(await lockChapterRowForStory(tx, input.chapterId, input.storyId))
        ) {
          return { status: 'not_found' };
        }

        const current = await tx.chapter.findFirst({
          where: {
            id: input.chapterId,
            storyId: input.storyId,
            deletedAt: null,
          },
          select: CHAPTER_SELECT,
        });
        if (!current) return { status: 'not_found' };
        if (current.status !== ChapterStatus.SCHEDULED) {
          return { status: 'not_scheduled' };
        }

        const updated = await tx.chapter.update({
          where: { id: current.id },
          data: {
            status: ChapterStatus.APPROVED,
            scheduledAt: null,
            version: { increment: 1 },
            versions: {
              create: workflowSnapshot(
                current,
                input.userId,
                current.version + 1,
                'Hủy lịch xuất bản',
              ),
            },
            updatedById: input.userId,
            updatedAt: input.canceledAt,
          },
          select: CHAPTER_SELECT,
        });

        await tx.auditLog.create({
          data: {
            actorId: input.userId,
            action: 'chapter.schedule.canceled',
            entityType: 'chapter',
            entityId: current.id,
            oldValues: {
              storyId: current.storyId,
              status: current.status,
              scheduledAt: current.scheduledAt?.toISOString() ?? null,
            },
            newValues: {
              storyId: updated.storyId,
              status: updated.status,
              scheduledAt: null,
            },
            ipAddress: input.audit.ipAddress,
            userAgent: input.audit.userAgent,
            requestId: input.audit.requestId,
            createdAt: input.canceledAt,
          },
        });

        return { status: 'canceled', chapter: this.toRecord(updated) };
      });
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'chapter-schedule-cancel',
        resource: 'Chương',
      });
    }
  }

  async publishDueScheduled(
    input: PublishDueScheduledChaptersInput,
  ): Promise<number> {
    const batchSize = Math.max(1, Math.min(input.batchSize, 100));
    const candidates = await this.prisma.chapter.findMany({
      where: {
        status: ChapterStatus.SCHEDULED,
        scheduledAt: { lte: input.dueAt },
        deletedAt: null,
        story: { status: StoryStatus.PUBLISHED, deletedAt: null },
      },
      orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
      take: batchSize,
      select: { id: true, storyId: true },
    });

    let publishedCount = 0;
    for (const candidate of candidates) {
      const published = await this.prisma.$transaction(async (tx) => {
        if (!(await lockStoryRowSkipLocked(tx, candidate.storyId)))
          return false;
        if (
          !(await lockChapterRowForStorySkipLocked(
            tx,
            candidate.id,
            candidate.storyId,
          ))
        ) {
          return false;
        }

        const [story, current] = await Promise.all([
          tx.story.findFirst({
            where: {
              id: candidate.storyId,
              status: StoryStatus.PUBLISHED,
              deletedAt: null,
            },
            select: {
              id: true,
              slug: true,
              title: true,
              authorId: true,
            },
          }),
          tx.chapter.findFirst({
            where: {
              id: candidate.id,
              storyId: candidate.storyId,
              status: ChapterStatus.SCHEDULED,
              scheduledAt: { lte: input.dueAt },
              deletedAt: null,
            },
            select: CHAPTER_SELECT,
          }),
        ]);

        if (!story || !current || !current.content.trim()) return false;

        const updated = await tx.chapter.update({
          where: { id: current.id },
          data: {
            status: ChapterStatus.PUBLISHED,
            publishedAt: input.dueAt,
            scheduledAt: null,
            version: { increment: 1 },
            versions: {
              create: {
                ...workflowSnapshot(
                  current,
                  current.updatedById,
                  current.version + 1,
                  'Xuất bản theo lịch',
                ),
                versionType: 'PUBLISHED',
              },
            },
            updatedById: current.updatedById,
            updatedAt: input.dueAt,
          },
          select: CHAPTER_SELECT,
        });

        await tx.story.update({
          where: { id: story.id },
          data: {
            chapterCount: { increment: 1 },
            lastChapterAt: input.dueAt,
            updatedAt: input.dueAt,
            version: { increment: 1 },
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: null,
            action: 'chapter.scheduled.published',
            entityType: 'chapter',
            entityId: current.id,
            oldValues: {
              storyId: current.storyId,
              status: current.status,
              scheduledAt: current.scheduledAt?.toISOString() ?? null,
            },
            newValues: {
              storyId: updated.storyId,
              status: updated.status,
              publishedAt: updated.publishedAt?.toISOString() ?? null,
            },
            metadata: { source: 'story-scheduling-worker' },
            requestId: input.requestId,
            createdAt: input.dueAt,
          },
        });
        await createChapterPublishedOutboxEvents(tx, {
          story,
          chapter: updated,
          publishedAt: input.dueAt,
          requestId: input.requestId,
        });

        return true;
      });

      if (published) publishedCount += 1;
    }

    return publishedCount;
  }

  async findPublicReader(
    storySlug: string,
    chapterNumber: string,
    viewerId: string | undefined,
    enforcePaywall: boolean,
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
        select: PUBLIC_CHAPTER_READER_METADATA_SELECT,
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

      const access = await this.resolveChapterAccess(
        chapter,
        viewerId,
        enforcePaywall,
      );
      if (access.state === 'LOCKED') {
        return toLockedPublicChapterReaderDto(
          chapter,
          previous,
          next,
          chapter.publishedAt,
          access.priceCredits,
        );
      }

      const content = await this.prisma.chapter.findUnique({
        where: { id: chapter.id },
        select: PUBLIC_CHAPTER_CONTENT_SELECT,
      });
      if (!content) {
        return null;
      }

      return toPublicChapterReaderDto(
        chapter,
        content,
        previous,
        next,
        chapter.publishedAt,
        access,
        this.readerFeatures.contentDocumentEnabled,
        this.readerFeatures.comicDeliveryEnabled,
        this.mediaUrl,
      );
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'public-chapter-reader',
        resource: 'Chương',
      });
    }
  }

  private async resolveChapterAccess(
    chapter: PublicChapterReaderMetadataRow,
    viewerId: string | undefined,
    enforcePaywall: boolean,
  ): Promise<
    | { readonly state: 'LOCKED'; readonly priceCredits: string }
    | {
        readonly state: 'FREE' | 'ENTITLED' | 'BYPASS';
        readonly priceCredits: string | null;
      }
  > {
    const pricing = chapter.monetization;
    if (!pricing || pricing.accessType !== ChapterAccessType.PAID) {
      return { state: 'FREE', priceCredits: null };
    }
    // A corrupt paid configuration must never fail open and expose full content.
    const priceCredits = pricing.creditPrice?.toString() ?? '0';
    const earlyAccessEnded =
      pricing.unlockPolicy === 'EARLY_ACCESS' &&
      ((pricing.freeAt && new Date() >= pricing.freeAt) ||
        (!pricing.freeAt &&
          pricing.paidWindowDays &&
          chapter.publishedAt &&
          new Date() >=
            new Date(
              chapter.publishedAt.getTime() +
                pricing.paidWindowDays * 86_400_000,
            )));
    if (earlyAccessEnded) return { state: 'FREE', priceCredits };
    if (!pricing.creditPrice || !pricing.previewContent) {
      return { state: 'LOCKED', priceCredits };
    }
    const effectivePaywall =
      enforcePaywall &&
      shouldEnforceChapterPaywall({
        config: this.monetization,
        userId: viewerId,
        storyId: chapter.storyId,
      });
    if (!effectivePaywall) {
      return { state: 'BYPASS', priceCredits };
    }
    if (!viewerId) {
      return { state: 'LOCKED', priceCredits };
    }
    if (chapter.story.authorId === viewerId) {
      return { state: 'BYPASS', priceCredits };
    }

    const [contributor, adminRole, entitlement] = await Promise.all([
      this.prisma.storyContributor.findFirst({
        where: { storyId: chapter.storyId, userId: viewerId },
        select: { userId: true },
      }),
      this.prisma.userRole.findFirst({
        where: {
          userId: viewerId,
          role: { code: 'ADMIN' },
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        select: { userId: true },
      }),
      this.prisma.chapterEntitlement.findFirst({
        where: {
          userId: viewerId,
          chapterId: chapter.id,
          status: ChapterEntitlementStatus.ACTIVE,
        },
        select: { id: true },
      }),
    ]);
    if (contributor || adminRole) {
      return { state: 'BYPASS', priceCredits };
    }
    if (entitlement) {
      return { state: 'ENTITLED', priceCredits };
    }
    return { state: 'LOCKED', priceCredits };
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
      contentDocument: toContentDocument(
        chapter.contentDocument,
        chapter.content,
        chapter.id,
      ),
      documentSchemaVersion: 1,
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

async function lockStoryRowSkipLocked(
  tx: Prisma.TransactionClient,
  storyId: string,
): Promise<boolean> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "stories"
    WHERE "id" = ${storyId}::uuid
      AND "deleted_at" IS NULL
    FOR UPDATE SKIP LOCKED
  `);

  return rows.length === 1;
}

async function lockChapterRowForStorySkipLocked(
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
    FOR UPDATE SKIP LOCKED
  `);

  return rows.length === 1;
}

interface ChapterPublishedOutboxInput {
  readonly story: {
    readonly id: string;
    readonly slug: string;
    readonly title: string;
    readonly authorId: string;
  };
  readonly chapter: ChapterRow;
  readonly publishedAt: Date;
  readonly requestId?: string;
}

async function createChapterPublishedOutboxEvents(
  tx: Prisma.TransactionClient,
  input: ChapterPublishedOutboxInput,
): Promise<void> {
  await tx.outboxEvent.create({
    data: {
      idempotencyKey: `author-chapter-published:${input.chapter.id}`,
      aggregateType: 'notifications',
      aggregateId: input.chapter.id,
      eventType: 'notification.author-chapter-published.v1',
      payload: {
        version: 1,
        authorId: input.story.authorId,
        storyId: input.story.id,
        storySlug: input.story.slug,
        storyTitle: input.story.title,
        chapterId: input.chapter.id,
        chapterNumber: input.chapter.number.toString(),
        chapterTitle: input.chapter.title,
        publishedAt: input.publishedAt.toISOString(),
      },
      metadata: { requestId: input.requestId ?? null },
      createdAt: input.publishedAt,
    },
  });
  await tx.outboxEvent.create({
    data: {
      idempotencyKey: `ai-auto-translate-chapter:${input.chapter.id}`,
      aggregateType: 'ai',
      aggregateId: input.chapter.id,
      eventType: 'ai.auto-translate-chapter-published.v1',
      payload: {
        version: 1,
        userId: input.story.authorId,
        storyId: input.story.id,
        chapterId: input.chapter.id,
      },
      metadata: { requestId: input.requestId ?? null },
      createdAt: input.publishedAt,
    },
  });
}

function toPublicChapterReaderDto(
  chapter: PublicChapterReaderMetadataRow,
  content: Prisma.ChapterGetPayload<{
    select: typeof PUBLIC_CHAPTER_CONTENT_SELECT;
  }>,
  previous: PublicChapterNavigationRow | null,
  next: PublicChapterNavigationRow | null,
  publishedAt: Date,
  access: {
    readonly state: 'FREE' | 'ENTITLED' | 'BYPASS';
    readonly priceCredits: string | null;
  },
  exposeContentDocument: boolean,
  exposeComicDelivery: boolean,
  mediaUrl: MediaUrlPort,
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
      access,
      content: content.content,
      ...(exposeContentDocument
        ? {
            contentDocument: toContentDocument(
              content.contentDocument,
              content.content,
              chapter.id,
            ),
            documentSchemaVersion: 1,
          }
        : {}),
      contentFormat: content.contentFormat,
      ...(exposeComicDelivery
        ? {
            media: content.media.flatMap((item) => {
              const publicId = item.mediaAsset.publicId;
              const width = item.mediaAsset.width;
              const height = item.mediaAsset.height;
              if (!publicId || !width || !height) return [];
              const requiresSigning = access.state !== 'FREE';
              if (
                requiresSigning &&
                item.mediaAsset.deliveryType !== 'authenticated'
              )
                return [];
              const slices = item.slices.length
                ? item.slices.map((slice) => ({
                    id: slice.id,
                    sliceIndex: slice.sliceIndex,
                    width: slice.width,
                    height: slice.height,
                    offsetY: slice.offsetY,
                    aspectRatio: slice.aspectRatio.toNumber(),
                  }))
                : [
                    {
                      id: `${item.mediaAssetId}:full`,
                      sliceIndex: 0,
                      width,
                      height,
                      offsetY: 0,
                      aspectRatio: width / height,
                    },
                  ];
              return [
                {
                  mediaAssetId: item.mediaAssetId,
                  sortOrder: item.sortOrder,
                  altText: item.altText,
                  caption: item.caption,
                  width,
                  height,
                  slices: slices.map((slice) => ({
                    id: slice.id,
                    sliceIndex: slice.sliceIndex,
                    width: slice.width,
                    height: slice.height,
                    offsetY: slice.offsetY,
                    aspectRatio: slice.aspectRatio,
                    urls: {
                      avif: mediaUrl.build({
                        publicId,
                        resourceType: 'image',
                        preset: 'chapterImage',
                        preferredFormat: 'avif',
                        slice,
                        requiresSigning,
                      }),
                      webp: mediaUrl.build({
                        publicId,
                        resourceType: 'image',
                        preset: 'chapterImage',
                        preferredFormat: 'webp',
                        slice,
                        requiresSigning,
                      }),
                      jpeg: mediaUrl.build({
                        publicId,
                        resourceType: 'image',
                        preset: 'chapterImage',
                        preferredFormat: 'jpg',
                        slice,
                        requiresSigning,
                      }),
                    },
                  })),
                },
              ];
            }),
          }
        : {}),
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

function toLockedPublicChapterReaderDto(
  chapter: PublicChapterReaderMetadataRow,
  previous: PublicChapterNavigationRow | null,
  next: PublicChapterNavigationRow | null,
  publishedAt: Date,
  priceCredits: string,
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
      access: { state: 'LOCKED', priceCredits },
      previewContent: chapter.monetization?.previewContent ?? '',
      previewFormat: ContentFormat.MARKDOWN,
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

function toChapterVersionRecord(
  version: ChapterVersionRow,
): ChapterVersionRecord {
  return {
    versionType: version.versionType,
    isRetained: version.isRetained,
    expiresAt: version.expiresAt,
    id: version.id,
    chapterId: version.chapterId,
    createdById: version.createdById,
    createdByDisplayName: version.createdBy.displayName,
    version: version.version,
    title: version.title,
    content: version.content,
    contentDocument: toContentDocument(
      version.contentDocument,
      version.content,
      version.chapterId,
    ),
    documentSchemaVersion: 1,
    contentFormat: version.contentFormat,
    wordCount: version.wordCount,
    changeSummary: version.changeSummary,
    createdAt: version.createdAt,
  };
}

function toContentDocument(
  value: Prisma.JsonValue | null,
  markdown: string,
  chapterId: string,
): ChapterContentDocument {
  if (value === null) {
    return createBackfilledChapterContentDocument(markdown, chapterId);
  }
  if (!isChapterContentDocument(value)) {
    throw new Error('Stored chapter content document is invalid');
  }
  return value;
}

function toPrismaJson(document: ChapterContentDocument): Prisma.InputJsonValue {
  return document as unknown as Prisma.InputJsonValue;
}

function describeChapterChanges(
  titleChanged: boolean,
  contentChanged: boolean,
): string {
  if (titleChanged && contentChanged) return 'Chỉnh sửa tiêu đề và nội dung';
  if (titleChanged) return 'Chỉnh sửa tiêu đề';
  return 'Chỉnh sửa nội dung';
}
