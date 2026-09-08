import type {
  ReadingCursorApi,
  ReadingHistoryApiItem,
} from '../../../../core/http/reader-engagement-api.model';

export function restoreTextCursor(
  document: Document,
  chapterId: string | undefined,
  progress: ReadingHistoryApiItem | null,
): void {
  const cursor = progress?.cursor;
  if (!chapterId || progress?.currentChapter?.id !== chapterId || cursor?.kind !== 'text') return;
  setTimeout(() => {
    const element = document.querySelector<HTMLElement>(
      `[data-reader-chapter-id="${chapterId}"] [data-block-id="${cursor.blockId}"]`,
    );
    if (typeof element?.scrollIntoView === 'function') {
      element.scrollIntoView({ block: 'start' });
    }
  });
}

export function readVisibleTextCursor(
  document: Document,
  chapterId: string,
): Extract<ReadingCursorApi, { kind: 'text' }> | null {
  const elements = Array.from(
    document.querySelectorAll<HTMLElement>(
      `[data-reader-chapter-id="${chapterId}"] [data-block-id]`,
    ),
  );
  if (elements.length === 0) return null;
  const sampleY = window.innerHeight * 0.35;
  const element = elements.find((candidate) => candidate.getBoundingClientRect().bottom >= sampleY);
  if (!element?.dataset['blockId']) return null;
  const rect = element.getBoundingClientRect();
  const ratioInBlock = Math.max(0, Math.min(1, (sampleY - rect.top) / Math.max(1, rect.height)));
  const characterOffset = Math.round((element.textContent?.length ?? 0) * ratioInBlock);
  const scrollRange = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  return {
    schemaVersion: 1,
    kind: 'text',
    blockId: element.dataset['blockId'],
    characterOffset,
    viewportRatio: Math.max(0, Math.min(1, window.scrollY / scrollRange)),
  };
}
