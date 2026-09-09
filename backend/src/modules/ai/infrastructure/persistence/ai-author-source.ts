import { Prisma } from '@/generated/prisma/client';
import {
  isChapterContentDocument,
  createBackfilledChapterContentDocument,
} from '@/modules/chapters';
import {
  AuthorJobError,
  type AuthorSource,
  type CreateAuthorJob,
} from '../../application/author-tools/ai-author.types';

export async function assertAuthorToolAccess(
  tx: Prisma.TransactionClient,
  userId: string,
  storyId: string,
): Promise<void> {
  const story = await tx.story.findFirst({
    where: {
      id: storyId,
      deletedAt: null,
      author: {
        lifecycleStatus: 'ACTIVE',
        user: { status: 'ACTIVE', deletedAt: null },
      },
      OR: [
        { authorId: userId },
        { contributors: { some: { userId, canEdit: true } } },
      ],
    },
    select: { id: true },
  });
  const user = await tx.user.findFirst({
    where: { id: userId, status: 'ACTIVE', deletedAt: null },
    select: { id: true },
  });
  if (!story || !user) throw new AuthorJobError('ACCESS_DENIED');
}
export async function loadAuthorSource(
  tx: Prisma.TransactionClient,
  input: Pick<CreateAuthorJob, 'userId' | 'storyId' | 'chapterId' | 'jobType'>,
): Promise<AuthorSource> {
  await assertAuthorToolAccess(tx, input.userId, input.storyId);
  const story = await tx.story.findUniqueOrThrow({
    where: { id: input.storyId },
    select: { version: true },
  });
  const target = input.chapterId
    ? await tx.chapter.findFirst({
        where: { id: input.chapterId, storyId: input.storyId, deletedAt: null },
        select: { id: true, number: true },
      })
    : null;
  if (input.chapterId && !target) throw new AuthorJobError('CHAPTER_NOT_FOUND');
  const base = { storyId: input.storyId, deletedAt: null };
  let where: Prisma.ChapterWhereInput = base;
  let take = 21;
  if (input.jobType === 'CHAPTER_SUMMARY')
    where = { ...base, id: input.chapterId };
  if (input.jobType === 'CONSISTENCY_CHECK' && target) {
    where = { ...base, number: { lte: target.number } };
    take = 6;
  }
  const chapters = await tx.chapter.findMany({
    where,
    take,
    orderBy: { number: input.jobType === 'CONSISTENCY_CHECK' ? 'desc' : 'asc' },
    select: {
      id: true,
      version: true,
      number: true,
      title: true,
      content: true,
      contentDocument: true,
    },
  });
  if (!chapters.length) throw new AuthorJobError('SOURCE_EMPTY');
  if (
    chapters.length > 20 ||
    chapters.reduce((size, c) => size + c.content.length + c.title.length, 0) >
      32_000
  )
    throw new AuthorJobError('SOURCE_TOO_LARGE');
  const characters =
    input.jobType === 'CONSISTENCY_CHECK'
      ? await tx.storyCharacter.findMany({
          where: { storyId: input.storyId },
          orderBy: { id: 'asc' },
          take: 41,
          select: {
            id: true,
            name: true,
            description: true,
            aliases: true,
            isVerified: true,
            updatedAt: true,
          },
        })
      : undefined;
  if (characters && characters.length > 40)
    throw new AuthorJobError('SOURCE_TOO_LARGE');
  return {
    storyVersion: story.version,
    ...(characters
      ? {
          characters: characters.map((c) => ({
            ...c,
            updatedAt: c.updatedAt.toISOString(),
          })),
        }
      : {}),
    chapters: chapters.map(({ contentDocument, ...c }) => ({
      ...c,
      number: c.number.toString(),
      ...(input.jobType === 'CONSISTENCY_CHECK'
        ? {
            blocks: (isChapterContentDocument(contentDocument)
              ? contentDocument
              : createBackfilledChapterContentDocument(c.content, c.id)
            ).blocks.map((block) => ({ id: block.id, text: block.text })),
          }
        : {}),
    })),
  };
}
export async function lockAuthorStory(
  tx: Prisma.TransactionClient,
  storyId: string,
): Promise<void> {
  await tx.$queryRaw(
    Prisma.sql`SELECT id FROM stories WHERE id = ${storyId}::uuid FOR UPDATE`,
  );
}
