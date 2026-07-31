import { randomUUID } from 'node:crypto';

export interface HttpRequestLike {
  id?: unknown;
  requestId?: unknown;
  method?: unknown;
  url?: unknown;
  originalUrl?: unknown;
  headers?: unknown;
  user?: unknown;
}

export interface RequestMetadata {
  requestId: string;
  method: string;
  path: string;
  userId?: string;
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function readHeader(
  headers: unknown,
  name: string,
): string | undefined {
  if (!headers || typeof headers !== 'object') {
    return undefined;
  }

  const maybeHeaders = headers as {
    get?: (headerName: string) => unknown;
    [key: string]: unknown;
  };

  if (typeof maybeHeaders.get === 'function') {
    return nonEmptyString(maybeHeaders.get(name));
  }

  const directValue = maybeHeaders[name] ?? maybeHeaders[name.toLowerCase()];

  if (Array.isArray(directValue)) {
    return nonEmptyString(directValue[0]);
  }

  return nonEmptyString(directValue);
}

function resolveUserId(user: unknown): string | undefined {
  if (!user || typeof user !== 'object') {
    return undefined;
  }

  const principal = user as Record<string, unknown>;

  return (
    nonEmptyString(principal.userId) ??
    nonEmptyString(principal.sub) ??
    nonEmptyString(principal.id)
  );
}

export function extractRequestMetadata(
  request: HttpRequestLike,
): RequestMetadata {
  const requestId =
    nonEmptyString(request.requestId) ??
    nonEmptyString(request.id) ??
    readHeader(request.headers, 'x-request-id') ??
    randomUUID();

  const userId = resolveUserId(request.user);

  return {
    requestId,
    method: nonEmptyString(request.method) ?? 'UNKNOWN',
    path:
      nonEmptyString(request.originalUrl) ??
      nonEmptyString(request.url) ??
      '/',
    ...(userId ? { userId } : {}),
  };
}
