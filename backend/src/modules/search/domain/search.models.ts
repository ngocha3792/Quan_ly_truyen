export type SearchKind = 'story' | 'chapter';
export type SearchSort =
  'relevance' | 'newest' | 'views' | 'followers' | 'rating';
export interface SearchInput {
  readonly q: string;
  readonly kind: SearchKind;
  readonly page: number;
  readonly pageSize: number;
  readonly category?: string;
  readonly tag?: string;
  readonly status?: 'published' | 'hiatus' | 'completed';
  readonly contentRating?: 'everyone' | 'teen' | 'mature';
  readonly yearFrom?: number;
  readonly yearTo?: number;
  readonly storyId?: string;
  readonly featured?: boolean;
  readonly sort: SearchSort;
}

/** Public-only projection. Paid text is never passed to the external engine. */
export interface SearchDocument {
  readonly id: string;
  readonly entityId: string;
  readonly kind: SearchKind;
  readonly title: string;
  readonly slug: string;
  readonly content: string;
  readonly authorName: string;
  readonly categories: readonly string[];
  readonly categorySlugs: readonly string[];
  readonly tags: readonly string[];
  readonly tagSlugs: readonly string[];
  readonly storyId: string;
  readonly storySlug: string;
  readonly storyTitle: string;
  readonly number: number | null;
  readonly accessType: 'free' | 'paid';
  readonly status: string;
  readonly contentRating: string;
  readonly releaseYear: number | null;
  readonly isFeatured: boolean;
  readonly publishedAt: number;
  readonly viewCount: number;
  readonly followerCount: number;
  readonly ratingAverage: number;
}
export interface SearchHit {
  readonly id: string;
  readonly kind: SearchKind;
  readonly title: string;
  readonly slug: string;
  readonly snippet: string;
  readonly authorName: string;
  readonly categories: readonly string[];
  readonly tags: readonly string[];
  readonly storyId: string;
  readonly storyTitle: string;
  readonly storySlug: string;
  readonly number: number | null;
  readonly accessState: 'FREE' | 'ENTITLED' | 'LOCKED';
}
export interface SearchResult {
  readonly hits: readonly SearchHit[];
  readonly totalHits: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
  readonly query: string;
  readonly engine: 'meilisearch' | 'postgres';
  readonly processingTimeMs: number;
}
