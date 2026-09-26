/** Một chương bị một lô bỏ qua, kèm lý do. */
export interface SkippedBulkChapterLike {
  readonly number: number;
  readonly title: string;
  readonly message: string;
}

export interface BulkChapterResultLike {
  readonly changed: readonly unknown[];
  readonly skipped: readonly SkippedBulkChapterLike[];
  readonly remaining: number;
}

/**
 * Một câu tóm tắt kết quả của lô.
 *
 * Lô chạy từng chương một nên gần như lúc nào cũng có phần xong và phần vướng;
 * chỉ báo "đã xong" là giấu mất phần vướng, mà đó mới là thứ người bấm cần
 * biết. Số còn lại cũng phải nói ra, không thì tác giả tưởng đã hết.
 */
export function summariseBulkChapterResult(result: BulkChapterResultLike, verb: string): string {
  const parts = [`Đã ${verb} ${result.changed.length} chương.`];

  if (result.skipped.length > 0) {
    parts.push(`Bỏ qua ${result.skipped.length} chương.`);
  }

  if (result.remaining > 0) {
    parts.push(`Còn ${result.remaining} chương — bấm lại để làm tiếp.`);
  }

  return parts.join(' ');
}

/** Từng dòng lý do, để hiện dưới câu tóm tắt. */
export function describeSkippedBulkChapters(result: BulkChapterResultLike): readonly string[] {
  return result.skipped.map(
    (chapter) => `Chương ${chapter.number} — ${chapter.title}: ${chapter.message}`,
  );
}
