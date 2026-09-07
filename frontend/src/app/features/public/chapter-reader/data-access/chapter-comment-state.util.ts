import type { CommentReactionApiType } from '../../../../core/http/reader-engagement-api.model';
import type { ChapterComment } from '../domain/chapter-reader.models';

export function applyOptimisticReaction(
  comment: ChapterComment,
  next: CommentReactionApiType | null,
): ChapterComment {
  const reactions = { ...comment.reactions };
  if (comment.viewerReaction)
    reactions[comment.viewerReaction] = Math.max(0, reactions[comment.viewerReaction] - 1);
  if (next) reactions[next] = reactions[next] + 1;
  return { ...comment, viewerReaction: next, reactions };
}

export function updateCommentTree(
  items: readonly ChapterComment[],
  id: string,
  update: (comment: ChapterComment) => ChapterComment,
): readonly ChapterComment[] {
  return items.map((item) => {
    if (item.id === id) return update(item);
    if (!item.replies.some((reply) => reply.id === id)) return item;
    return {
      ...item,
      replies: item.replies.map((reply) => (reply.id === id ? update(reply) : reply)),
    };
  });
}

export function findCommentInTree(
  items: readonly ChapterComment[],
  id: string,
): ChapterComment | null {
  for (const item of items) {
    if (item.id === id) return item;
    const reply = item.replies.find((candidate) => candidate.id === id);
    if (reply) return reply;
  }
  return null;
}
