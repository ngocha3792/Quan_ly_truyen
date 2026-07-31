import { SortDirection } from '@/common/enums';

export interface CursorPaginationInput {
    cursor?: string;
    limit: number;
    direction?: SortDirection;
}

export interface CursorPaginationMeta {
    nextCursor: string | null;
    previousCursor?: string | null;
    hasNextPage: boolean;
}

export interface CursorPaginatedResult<T> {
    items: readonly T[];
    meta: CursorPaginationMeta;
}
export interface StoryCursor {
    createdAt: string;
    id: string;
}