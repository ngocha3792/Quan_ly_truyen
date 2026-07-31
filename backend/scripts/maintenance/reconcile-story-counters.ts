import {
  hasFlag,
  readArgument,
  readPositiveInteger,
} from '../shared/script-arguments';
import { createScriptPrismaClient } from '../shared/prisma-client';
import { runScript } from '../shared/script-runner';

const prisma = createScriptPrismaClient();

interface ComputedStoryCounters {
  followerCount: number;
  ratingCount: number;
  ratingAverage: number;
  chapterCount: number;
  commentCount: number;
  lastChapterAt: Date | null;
}

async function computeStoryCounters(
  storyId: string,
): Promise<ComputedStoryCounters> {
  const [followerCount, ratingAggregate, chapterRows, commentCount] =
    await Promise.all([
      prisma.storyFollow.count({
        where: {
          storyId,
        },
      }),

      prisma.rating.aggregate({
        where: {
          storyId,
          deletedAt: null,
          moderationStatus: 'VISIBLE',
        },
        _count: {
          _all: true,
        },
        _avg: {
          score: true,
        },
      }),

      prisma.chapter.aggregate({
        where: {
          storyId,
          deletedAt: null,
          status: 'PUBLISHED',
        },
        _count: {
          _all: true,
        },
        _max: {
          publishedAt: true,
        },
      }),

      prisma.comment.count({
        where: {
          storyId,
          deletedAt: null,
          moderationStatus: 'VISIBLE',
        },
      }),
    ]);

  const rawAverage = Number(ratingAggregate._avg.score ?? 0);
  const roundedAverage = Math.round(rawAverage * 100) / 100;

  return {
    followerCount,
    ratingCount: ratingAggregate._count._all,
    ratingAverage: roundedAverage,
    chapterCount: chapterRows._count._all,
    commentCount,
    lastChapterAt: chapterRows._max.publishedAt ?? null,
  };
}

void runScript({
  name: 'reconcile-story-counters',

  async execute({ logger }) {
    const apply = hasFlag('apply');
    const storyId = readArgument('story-id');
    const batchSize = readPositiveInteger('batch-size', 100);
    const limit = readPositiveInteger('limit', 10_000);

    let cursor: string | undefined;
    let scanned = 0;
    let mismatched = 0;
    let updated = 0;

    while (scanned < limit) {
      const stories = await prisma.story.findMany({
        where: {
          deletedAt: null,
          ...(storyId ? { id: storyId } : {}),
        },
        select: {
          id: true,
          followerCount: true,
          ratingCount: true,
          ratingAverage: true,
          chapterCount: true,
          commentCount: true,
          lastChapterAt: true,
        },
        orderBy: {
          id: 'asc',
        },
        take: Math.min(batchSize, limit - scanned),
        ...(cursor
          ? {
              cursor: {
                id: cursor,
              },
              skip: 1,
            }
          : {}),
      });

      if (stories.length === 0) {
        break;
      }

      for (const story of stories) {
        const expected = await computeStoryCounters(story.id);

        const differs =
          story.followerCount !== expected.followerCount ||
          story.ratingCount !== expected.ratingCount ||
          Number(story.ratingAverage) !== expected.ratingAverage ||
          story.chapterCount !== expected.chapterCount ||
          story.commentCount !== expected.commentCount ||
          story.lastChapterAt?.getTime() !== expected.lastChapterAt?.getTime();

        scanned += 1;

        if (!differs) {
          continue;
        }

        mismatched += 1;

        logger.warn('story counter mismatch', {
          storyId: story.id,
        });

        if (apply) {
          await prisma.story.update({
            where: {
              id: story.id,
            },
            data: expected,
          });

          updated += 1;
        }
      }

      cursor = stories.at(-1)?.id;

      if (storyId) {
        break;
      }
    }

    logger.info('story counter reconciliation finished', {
      mode: apply ? 'apply' : 'dry-run',
      scanned,
      mismatched,
      updated,
    });
  },

  cleanup: () => prisma.$disconnect(),
});
