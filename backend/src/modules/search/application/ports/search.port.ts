import type {
  SearchDocument,
  SearchHit,
  SearchInput,
  SearchResult,
} from '../../domain/search.models';

export const SEARCH_QUERY_PORT = Symbol.for('modules.search.query');
export const SEARCH_ADMIN_PORT = Symbol.for('modules.search.admin');
export const SEARCH_ENGINE_PORT = Symbol.for('modules.search.engine');
export interface SearchQueryPort {
  search(input: SearchInput, viewerId?: string): Promise<SearchResult>;
  filters(): Promise<{
    categories: Array<{ name: string; slug: string }>;
    tags: Array<{ name: string; slug: string }>;
  }>;
}
export interface SearchAdminPort {
  rebuild(): Promise<unknown>;
  status(): Promise<unknown>;
}
export interface SearchEnginePort {
  search(
    index: string,
    input: SearchInput,
  ): Promise<{
    hits: Array<{ id: string; sourceHash: string }>;
    total: number;
  }>;
  configure(index: string): Promise<void>;
  upsert(index: string, documents: readonly SearchDocument[]): Promise<void>;
  remove(index: string, ids: readonly string[]): Promise<void>;
  drop(index: string): Promise<void>;
}
export interface SearchHydration {
  readonly hits: readonly SearchHit[];
  readonly dropped: boolean;
}
