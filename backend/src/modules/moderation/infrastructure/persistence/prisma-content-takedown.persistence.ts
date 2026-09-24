import { Injectable } from '@nestjs/common';

import {
  ChapterPurchaseStatus,
  ChapterStatus,
  ModerationActionType,
  Prisma,
} from '@/generated/prisma/client';
import { mapPrismaError, PrismaService } from '@/infrastructure/database';

import type {
  ContentTakedownPersistencePort,
  TakeDownChapterInput,
  TakeDownChapterResult,
  TakeDownStoryInput,
  TakeDownStoryResult,
} from '../../application';

const CHAPTER_SELECT = {
  id: true,
  storyId: true,
  number: true,
  title: true,
  slug: true,
  status: true,
  version: true,
  publishedAt: true,
} satisfies Prisma.ChapterSelect;

const STORY_SELECT = {
  id: true,
  authorId: true,
  title: true,
  slug: true,
  status: true,
  coverMediaId: true,
  version: true,
} satisfies Prisma.StorySelect;

@Injectable()
export class PrismaContentTakedownPersistence implements ContentTakedownPersistencePort {
  constructor(private readonly prisma: PrismaService) {}

  async takeDownChapter(
    input: TakeDownChapterInput,
  ): Promise<TakeDownChapterResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Khóa theo thứ tự story -> chapter giống các luồng ghi khác của
        // chương để hai giao dịch không ôm khóa chéo nhau.
        const owner = await tx.chapter.findFirst({
          where: { id: input.chapterId, deletedAt: null },
          select: { storyId: true },
        });

        if (!owner) {
          return { status: 'not_found' } as const;
        }

        await lockStoryRow(tx, owner.storyId);

        if (!(await lockChapterRow(tx, input.chapterId))) {
          return { status: 'not_found' } as const;
        }

        const chapter = await tx.chapter.findFirst({
          where: { id: input.chapterId, deletedAt: null },
          select: CHAPTER_SELECT,
        });

        if (!chapter) {
          return { status: 'not_found' } as const;
        }

        const purchaseCount = await tx.chapterPurchase.count({
          where: {
            chapterId: chapter.id,
            status: ChapterPurchaseStatus.COMPLETED,
          },
        });

        if (purchaseCount > 0 && !input.acknowledgePurchases) {
          return { status: 'purchases_exist', purchaseCount } as const;
        }

        await tx.chapter.update({
          where: { id: chapter.id },
          data: {
            deletedAt: input.takenDownAt,
            updatedById: input.actorId,
            updatedAt: input.takenDownAt,
          },
        });

        // `chapterCount` chỉ tăng lúc xuất bản, nên chỉ chương đã xuất bản
        // mới phải trả lại một đơn vị; `lastChapterAt` tính lại từ các chương
        // còn sống để không trỏ vào chương vừa gỡ.
        if (chapter.status === ChapterStatus.PUBLISHED) {
          await this.rollbackPublishedChapterCounters(
            tx,
            chapter.storyId,
            input.takenDownAt,
          );
        }

        await tx.moderationAction.create({
          data: {
            actorId: input.actorId,
            storyId: chapter.storyId,
            chapterId: chapter.id,
            action: ModerationActionType.HIDE_CHAPTER,
            reason: input.reason,
            metadata: {
              operation: 'takedown',
              previousStatus: chapter.status,
              purchaseCount,
              acknowledgePurchases: input.acknowledgePurchases,
            },
            createdAt: input.takenDownAt,
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: input.actorId,
            action: 'chapter.admin.taken_down',
            entityType: 'chapter',
            entityId: chapter.id,
            oldValues: {
              storyId: chapter.storyId,
              number: chapter.number.toString(),
              title: chapter.title,
              slug: chapter.slug,
              status: chapter.status,
              version: chapter.version,
            },
            newValues: {
              deletedAt: input.takenDownAt.toISOString(),
              purchaseCount,
            },
            metadata: {
              reason: input.reason,
              acknowledgePurchases: input.acknowledgePurchases,
            },
            ...input.audit,
            createdAt: input.takenDownAt,
          },
        });

        return {
          status: 'taken_down',
          chapterId: chapter.id,
          storyId: chapter.storyId,
          number: chapter.number.toString(),
          title: chapter.title,
          purchaseCount,
        } as const;
      });
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'chapter-admin-takedown',
        resource: 'Chương',
      });
    }
  }

  async takeDownStory(input: TakeDownStoryInput): Promise<TakeDownStoryResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (!(await lockStoryRow(tx, input.storyId))) {
          return { status: 'not_found' } as const;
        }

        const story = await tx.story.findFirst({
          where: { id: input.storyId, deletedAt: null },
          select: STORY_SELECT,
        });

        if (!story) {
          return { status: 'not_found' } as const;
        }

        const purchaseCount = await tx.chapterPurchase.count({
          where: {
            status: ChapterPurchaseStatus.COMPLETED,
            chapter: { storyId: story.id },
          },
        });

        if (purchaseCount > 0 && !input.acknowledgePurchases) {
          return { status: 'purchases_exist', purchaseCount } as const;
        }

        const deletedChapters = await tx.chapter.updateMany({
          where: { storyId: story.id, deletedAt: null },
          data: {
            deletedAt: input.takenDownAt,
            updatedAt: input.takenDownAt,
            updatedById: input.actorId,
          },
        });

        await tx.story.update({
          where: { id: story.id },
          data: {
            deletedAt: input.takenDownAt,
            coverMediaId: null,
            updatedAt: input.takenDownAt,
            version: { increment: 1 },
          },
        });

        await tx.authorProfile.updateMany({
          where: { userId: story.authorId, storyCount: { gt: 0 } },
          data: { storyCount: { decrement: 1 } },
        });

        await tx.moderationAction.create({
          data: {
            actorId: input.actorId,
            storyId: story.id,
            targetUserId: story.authorId,
            action: ModerationActionType.SUSPEND_STORY,
            reason: input.reason,
            metadata: {
              operation: 'takedown',
              previousStatus: story.status,
              deletedChapterCount: deletedChapters.count,
              purchaseCount,
              acknowledgePurchases: input.acknowledgePurchases,
            },
            createdAt: input.takenDownAt,
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: input.actorId,
            action: 'story.admin.taken_down',
            entityType: 'story',
            entityId: story.id,
            oldValues: {
              authorId: story.authorId,
              title: story.title,
              slug: story.slug,
              status: story.status,
              coverMediaId: story.coverMediaId,
              version: story.version,
            },
            newValues: {
              deletedAt: input.takenDownAt.toISOString(),
              coverMediaId: null,
              deletedChapterCount: deletedChapters.count,
              purchaseCount,
              version: story.version + 1,
            },
            metadata: {
              reason: input.reason,
              acknowledgePurchases: input.acknowledgePurchases,
            },
            ...input.audit,
            createdAt: input.takenDownAt,
          },
        });

        return {
          status: 'taken_down',
          storyId: story.id,
          title: story.title,
          slug: story.slug,
          chapterCount: deletedChapters.count,
          purchaseCount,
        } as const;
      });
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'story-admin-takedown',
        resource: 'Truyện',
      });
    }
  }

  private async rollbackPublishedChapterCounters(
    tx: Prisma.TransactionClient,
    storyId: string,
    takenDownAt: Date,
  ): Promise<void> {
    const latest = await tx.chapter.findFirst({
      where: {
        storyId,
        deletedAt: null,
        status: ChapterStatus.PUBLISHED,
        publishedAt: { not: null },
      },
      orderBy: { publishedAt: 'desc' },
      select: { publishedAt: true },
    });

    await tx.story.updateMany({
      where: { id: storyId, chapterCount: { gt: 0 } },
      data: { chapterCount: { decrement: 1 } },
    });

    await tx.story.update({
      where: { id: storyId },
      data: {
        lastChapterAt: latest?.publishedAt ?? null,
        updatedAt: takenDownAt,
        version: { increment: 1 },
      },
    });
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
      AND "deleted_at" IS NULL
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
      AND "deleted_at" IS NULL
    FOR UPDATE
  `);

  return rows.length === 1;
}
