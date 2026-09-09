import {
  ChapterAccessType,
  ChapterEntitlementStatus,
  ChapterStatus,
  Prisma,
  StoryStatus,
  StoryVisibility,
} from '@/generated/prisma/client';
import { CommentAnchorAccessDeniedException } from '../../domain';

const THREAD_CONTEXT_SELECT = {
  id: true,
  parentId: true,
  anchor: {
    select: {
      chapterId: true,
      chapterVersion: true,
      lastVerifiedVersion: true,
      status: true,
      startBlockId: true,
      endBlockId: true,
      startOffset: true,
      endOffset: true,
      quoteText: true,
    },
  },
} satisfies Prisma.CommentSelect;

/** Replies inherit the root's server-owned anchor; parent ids cannot be edited. */
export async function findThreadAnchor(
  tx: Pick<Prisma.TransactionClient, 'comment'>,
  commentId: string,
) {
  let cursor: string | null = commentId;
  for (let depth = 0; cursor && depth < 3; depth += 1) {
    const row: Prisma.CommentGetPayload<{
      select: typeof THREAD_CONTEXT_SELECT;
    }> | null = await tx.comment.findUnique({
      where: { id: cursor },
      select: THREAD_CONTEXT_SELECT,
    });
    if (!row) return null;
    if (row.anchor) return { ...row.anchor, rootCommentId: row.id };
    cursor = row.parentId;
  }
  return null;
}

/** Apply the same publication and paid-access gate as an anchored root. */
export async function assertInlineThreadAccess(
  tx: Prisma.TransactionClient,
  userId: string,
  chapterId: string,
): Promise<void> {
  const chapter = await tx.chapter.findFirst({
    where: {
      id: chapterId,
      status: ChapterStatus.PUBLISHED,
      deletedAt: null,
      publishedAt: { not: null },
      story: {
        deletedAt: null,
        visibility: StoryVisibility.PUBLIC,
        publishedAt: { not: null },
        status: {
          in: [
            StoryStatus.PUBLISHED,
            StoryStatus.HIATUS,
            StoryStatus.COMPLETED,
          ],
        },
      },
    },
    select: {
      storyId: true,
      story: { select: { authorId: true } },
      monetization: { select: { accessType: true } },
    },
  });
  if (!chapter) throw new CommentAnchorAccessDeniedException();
  if (
    chapter.monetization?.accessType !== ChapterAccessType.PAID ||
    chapter.story.authorId === userId
  )
    return;
  const [contributor, admin, entitlement] = await Promise.all([
    tx.storyContributor.findFirst({
      where: { storyId: chapter.storyId, userId },
      select: { userId: true },
    }),
    tx.userRole.findFirst({
      where: {
        userId,
        role: { code: 'ADMIN' },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { userId: true },
    }),
    tx.chapterEntitlement.findFirst({
      where: { userId, chapterId, status: ChapterEntitlementStatus.ACTIVE },
      select: { id: true },
    }),
  ]);
  if (!contributor && !admin && !entitlement)
    throw new CommentAnchorAccessDeniedException();
}
