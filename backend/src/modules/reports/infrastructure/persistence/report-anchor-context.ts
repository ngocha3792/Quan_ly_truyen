import type { Prisma } from '@/generated/prisma/client';

function object(value: Prisma.JsonValue | undefined): Prisma.JsonObject | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : null;
}

export function reportAnchorContext(evidence: Prisma.JsonValue | null) {
  const context = object(object(evidence ?? undefined)?.context);
  // Older reports contain optional client-supplied hints, not verified evidence.
  if (context?.source !== 'SERVER') return null;
  const anchor = object(context.anchor);
  if (
    !anchor ||
    typeof anchor.blockId !== 'string' ||
    typeof anchor.chapterVersion !== 'number'
  )
    return null;
  return {
    blockId: anchor.blockId,
    quote: typeof anchor.quote === 'string' ? anchor.quote : '',
    chapterVersion: anchor.chapterVersion,
    reportedChapterVersion:
      typeof context.chapterVersion === 'number'
        ? context.chapterVersion
        : null,
    lastVerifiedVersion:
      typeof anchor.lastVerifiedVersion === 'number'
        ? anchor.lastVerifiedVersion
        : null,
    status: typeof anchor.status === 'string' ? anchor.status : 'UNKNOWN',
    rootCommentId:
      typeof anchor.rootCommentId === 'string' ? anchor.rootCommentId : null,
  };
}
