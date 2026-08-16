import { hasFlag, readArgument, readPositiveInteger } from '../shared/script-arguments';
import { createScriptPrismaClient } from '../shared/prisma-client';
import { runScript } from '../shared/script-runner';

const prisma = createScriptPrismaClient();

void runScript({
  name: 'reconcile-author-follower-counts',
  async execute({ logger }) {
    const apply = hasFlag('apply');
    const authorId = readArgument('author-id');
    const batchSize = readPositiveInteger('batch-size', 100);
    const limit = readPositiveInteger('limit', 10_000);

    let cursor: string | undefined;
    let scanned = 0;
    let mismatched = 0;
    let updated = 0;

    while (scanned < limit) {
      const authors = await prisma.authorProfile.findMany({
        where: authorId ? { userId: authorId } : undefined,
        select: { userId: true, followerCount: true },
        orderBy: { userId: 'asc' },
        take: Math.min(batchSize, limit - scanned),
        ...(cursor
          ? { cursor: { userId: cursor }, skip: 1 }
          : {}),
      });
      if (authors.length === 0) break;

      const grouped = await prisma.userFollowAuthor.groupBy({
        by: ['authorId'],
        where: { authorId: { in: authors.map((author) => author.userId) } },
        _count: { _all: true },
      });
      const counts = new Map(grouped.map((row) => [row.authorId, row._count._all]));

      for (const author of authors) {
        const expected = counts.get(author.userId) ?? 0;
        scanned += 1;
        if (author.followerCount === expected) continue;
        mismatched += 1;
        logger.warn('author follower counter mismatch', {
          authorId: author.userId,
          stored: author.followerCount,
          expected,
        });
        if (apply) {
          await prisma.authorProfile.update({
            where: { userId: author.userId },
            data: { followerCount: expected },
          });
          updated += 1;
        }
      }

      cursor = authors.at(-1)?.userId;
      if (authorId) break;
    }

    logger.info('author follower reconciliation finished', {
      mode: apply ? 'apply' : 'dry-run',
      scanned,
      mismatched,
      updated,
    });
  },
  cleanup: () => prisma.$disconnect(),
});
