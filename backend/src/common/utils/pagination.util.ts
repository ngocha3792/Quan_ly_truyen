export interface PageMetaInput {
  page: number;
  limit: number;
  totalItems: number;
}

export interface PageMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export function calculateOffset(page: number, limit: number): number {
  assertPositiveInteger(page, 'page');
  assertPositiveInteger(limit, 'limit');

  return (page - 1) * limit;
}

export function createPageMeta(input: PageMetaInput): PageMeta {
  assertPositiveInteger(input.page, 'page');
  assertPositiveInteger(input.limit, 'limit');

  if (!Number.isSafeInteger(input.totalItems) || input.totalItems < 0) {
    throw new RangeError('totalItems phải là số nguyên không âm');
  }

  const totalPages = Math.ceil(input.totalItems / input.limit);

  return {
    page: input.page,
    limit: input.limit,
    totalItems: input.totalItems,
    totalPages,
    hasNextPage: input.page < totalPages,
    hasPreviousPage: input.page > 1 && totalPages > 0,
  };
}

export function encodeCursor<TCursor extends object>(cursor: TCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeCursor<TCursor extends object>(
  cursor: string,
): TCursor | null {
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf8');
    const value: unknown = JSON.parse(json);

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    return value as TCursor;
  } catch {
    return null;
  }
}

function assertPositiveInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${field} phải là số nguyên dương`);
  }
}
