import { Prisma } from '@/generated/prisma/client';

export function editableStoryWhere(userId: string): Prisma.StoryWhereInput {
  return {
    deletedAt: null,
    OR: [
      { authorId: userId },
      { contributors: { some: { userId, canEdit: true } } },
    ],
  };
}

export async function lockAndFindEditableStory(
  tx: Prisma.TransactionClient,
  storyId: string,
  userId: string,
) {
  await tx.$queryRaw(Prisma.sql`
    SELECT "id" FROM "stories" WHERE "id" = ${storyId}::uuid FOR UPDATE
  `);
  return tx.story.findFirst({
    where: {
      id: storyId,
      ...editableStoryWhere(userId),
      author: { lifecycleStatus: 'ACTIVE' },
    },
    select: { id: true, authorId: true, status: true },
  });
}
