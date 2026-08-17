import { Injectable } from '@nestjs/common';

import { ModerationStatus, Prisma } from '@/generated/prisma/client';
import { mapPrismaError, PrismaService } from '@/infrastructure/database';

import type {
  RatingPersistencePort,
  StoryRatingResultDto,
  UpsertRatingInput,
  UpsertRatingResult,
} from '../../application';

@Injectable()
export class PrismaRatingPersistence implements RatingPersistencePort {
  constructor(private readonly prisma: PrismaService) {}

  async findMine(
    userId: string,
    storyId: string,
  ): Promise<StoryRatingResultDto | null> {
    try {
      const rating = await this.prisma.rating.findFirst({
        where: {
          userId,
          storyId,
          deletedAt: null,
          moderationStatus: ModerationStatus.VISIBLE,
        },
        select: { storyId: true, score: true, updatedAt: true },
      });

      return rating ? toRatingDto(rating) : null;
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'rating-read-own',
        resource: 'Đánh giá',
      });
    }
  }

  async upsert(input: UpsertRatingInput): Promise<UpsertRatingResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (!(await lockPublicStory(tx, input.storyId))) {
          return { status: 'story_not_found' as const };
        }

        const rating = await tx.rating.upsert({
          where: {
            userId_storyId: { userId: input.userId, storyId: input.storyId },
          },
          create: {
            userId: input.userId,
            storyId: input.storyId,
            score: input.score,
            moderationStatus: ModerationStatus.VISIBLE,
            updatedAt: input.updatedAt,
          },
          update: {
            score: input.score,
            moderationStatus: ModerationStatus.VISIBLE,
            deletedAt: null,
            updatedAt: input.updatedAt,
          },
          select: { storyId: true, score: true, updatedAt: true },
        });

        await refreshRatingAggregate(tx, input.storyId);
        return { status: 'updated' as const, rating: toRatingDto(rating) };
      });
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'rating-upsert-own',
        resource: 'Đánh giá',
      });
    }
  }

  async deleteMine(userId: string, storyId: string): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        if (!(await lockStoryWithOwnedRating(tx, userId, storyId))) return;

        await tx.rating.updateMany({
          where: { userId, storyId, deletedAt: null },
          data: { deletedAt: new Date() },
        });
        await refreshRatingAggregate(tx, storyId);
      });
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'rating-delete-own',
        resource: 'Đánh giá',
      });
    }
  }
}

function toRatingDto(row: {
  storyId: string;
  score: number;
  updatedAt: Date;
}): StoryRatingResultDto {
  return {
    storyId: row.storyId,
    score: row.score,
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function lockPublicStory(
  tx: Prisma.TransactionClient,
  storyId: string,
): Promise<boolean> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "stories"
    WHERE "id" = ${storyId}::uuid
      AND "deleted_at" IS NULL
      AND "visibility" = 'public'
      AND "published_at" IS NOT NULL
      AND "status" IN ('published', 'hiatus', 'completed')
    FOR UPDATE
  `);
  return rows.length === 1;
}

async function lockStoryWithOwnedRating(
  tx: Prisma.TransactionClient,
  userId: string,
  storyId: string,
): Promise<boolean> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT s."id"
    FROM "stories" AS s
    WHERE s."id" = ${storyId}::uuid
      AND EXISTS (
        SELECT 1
        FROM "ratings" AS r
        WHERE r."story_id" = s."id"
          AND r."user_id" = ${userId}::uuid
          AND r."deleted_at" IS NULL
      )
    FOR UPDATE OF s
  `);
  return rows.length === 1;
}

async function refreshRatingAggregate(
  tx: Prisma.TransactionClient,
  storyId: string,
): Promise<void> {
  const aggregate = await tx.rating.aggregate({
    where: {
      storyId,
      deletedAt: null,
      moderationStatus: ModerationStatus.VISIBLE,
    },
    _count: { _all: true },
    _avg: { score: true },
  });

  await tx.story.updateMany({
    where: { id: storyId, deletedAt: null },
    data: {
      ratingCount: aggregate._count._all,
      ratingAverage: aggregate._avg.score ?? 0,
    },
  });
}
