import { createHash } from 'node:crypto';
import type { SearchDocument, SearchInput } from '../../domain/search.models';
import { normalizeSearchText } from '../../domain/policies/search-text.policy';

export const SEARCH_SETTINGS = {
  searchableAttributes: [
    'title',
    'titleNormalized',
    'authorName',
    'authorNormalized',
    'categories',
    'categoryNormalized',
    'tags',
    'tagNormalized',
    'storyTitle',
    'content',
    'contentNormalized',
  ],
  filterableAttributes: [
    'kind',
    'categorySlugs',
    'tagSlugs',
    'status',
    'contentRating',
    'releaseYear',
    'isFeatured',
    'storyId',
  ],
  sortableAttributes: [
    'publishedAt',
    'viewCount',
    'followerCount',
    'ratingAverage',
  ],
  rankingRules: [
    'words',
    'typo',
    'proximity',
    'attribute',
    'sort',
    'exactness',
  ],
  // Only identifiers and fingerprints leave the engine. PostgreSQL owns snippets.
  displayedAttributes: ['id', 'sourceHash'],
  typoTolerance: {
    enabled: true,
    minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 },
  },
  pagination: { maxTotalHits: 20000 },
};
export function sourceHash(document: SearchDocument): string {
  // Ranking counters may be eventually consistent; access/content/filter fields
  // must match exactly before a result can be served.
  return createHash('sha256')
    .update(
      JSON.stringify({
        ...document,
        viewCount: 0,
        followerCount: 0,
        ratingAverage: 0,
      }),
    )
    .digest('hex');
}
export function toIndexDocument(document: SearchDocument) {
  return {
    ...document,
    sourceHash: sourceHash(document),
    titleNormalized: normalizeSearchText(document.title),
    authorNormalized: normalizeSearchText(document.authorName),
    categoryNormalized: document.categories.map(normalizeSearchText),
    tagNormalized: document.tags.map(normalizeSearchText),
    contentNormalized: normalizeSearchText(document.content),
  };
}
export function meiliFilters(input: SearchInput): string[] {
  const quote = (value: string): string => JSON.stringify(value);
  const result = [`kind = ${quote(input.kind)}`];
  if (input.category) result.push(`categorySlugs = ${quote(input.category)}`);
  if (input.tag) result.push(`tagSlugs = ${quote(input.tag)}`);
  if (input.status) result.push(`status = ${quote(input.status)}`);
  if (input.contentRating)
    result.push(`contentRating = ${quote(input.contentRating)}`);
  if (input.storyId) result.push(`storyId = ${quote(input.storyId)}`);
  if (input.yearFrom) result.push(`releaseYear >= ${input.yearFrom}`);
  if (input.yearTo) result.push(`releaseYear <= ${input.yearTo}`);
  if (input.featured !== undefined)
    result.push(`isFeatured = ${input.featured}`);
  return result;
}
