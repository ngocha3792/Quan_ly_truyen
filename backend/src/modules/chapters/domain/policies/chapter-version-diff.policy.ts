import { diffLines } from 'diff';
import { InvalidInputException } from '@/common/exceptions';

export interface ChapterDiffChange {
  readonly type: 'added' | 'removed' | 'unchanged';
  readonly value: string;
  readonly count: number;
}

/** Bound work for large revisions; never silently truncate an author's diff. */
export function chapterVersionDiff(before: string, after: string) {
  const result = diffLines(before, after, {
    timeout: 100,
    maxEditLength: 5000,
  });
  if (!result) {
    throw new InvalidInputException({
      code: 'CHAPTER_DIFF_TOO_LARGE',
      message:
        'Hai bản có quá nhiều khác biệt. Hãy chọn các phiên bản gần nhau hơn.',
    });
  }
  const stats = { added: 0, removed: 0, unchanged: 0 };
  const changes: ChapterDiffChange[] = result.map((change) => {
    const type = change.added
      ? 'added'
      : change.removed
        ? 'removed'
        : 'unchanged';
    stats[type] += change.count;
    return { type, value: change.value, count: change.count };
  });
  return { changes, stats };
}
