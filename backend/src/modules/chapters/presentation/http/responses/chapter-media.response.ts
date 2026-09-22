import type { ChapterMediaRecord } from '../../../application';

export interface ChapterMediaResponse {
  readonly mediaAssetId: string;
  readonly sortOrder: number;
  readonly altText: string | null;
  readonly caption: string | null;
  readonly url: string | null;
  readonly width: number | null;
  readonly height: number | null;
}

export function toChapterMediaResponse(
  record: ChapterMediaRecord,
): ChapterMediaResponse {
  return { ...record };
}

export function toChapterMediaListResponse(
  records: readonly ChapterMediaRecord[],
): readonly ChapterMediaResponse[] {
  return records.map((record) => toChapterMediaResponse(record));
}
