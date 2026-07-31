import { SortDirection } from '@/common/enums';

export interface PagePaginationInput {
  page: number;
  limit: number;

  sortBy?: string;
  sortDirection?: SortDirection;
}

export interface PagePaginationMeta {
  page: number;
  limit: number;

  totalItems: number;
  totalPages: number;

  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedResult<T> {
  items: readonly T[];
  meta: PagePaginationMeta;
}
