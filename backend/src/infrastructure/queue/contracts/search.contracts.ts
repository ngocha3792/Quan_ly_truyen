export const SEARCH_DOCUMENT_CHANGED = 'search.document.changed.v1';
export const SEARCH_INDEX_TICK = 'search.index-tick.v1';
export interface SearchDocumentChangedV1 {
  readonly version: 1;
  readonly documentId: string;
}
export function isSearchDocumentChanged(
  value: unknown,
): value is SearchDocumentChangedV1 {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    record.version === 1 &&
    typeof record.documentId === 'string' &&
    /^(story|chapter)_[0-9a-f-]{36}$/u.test(record.documentId)
  );
}
