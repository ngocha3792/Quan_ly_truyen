export interface MutableRequestContext {
  requestId: string;
  correlationId: string;
  method: string;
  path: string;
  startedAt: Date;
  locale?: string;
  ipAddress?: string;
  userAgent?: string;
  userId?: string;
  sessionId?: string;
}

export interface MiddlewareHttpRequest {
  id?: unknown;
  requestId?: unknown;
  correlationId?: unknown;
  locale?: unknown;
  method?: unknown;
  url?: unknown;
  originalUrl?: unknown;
  headers?: unknown;
  ip?: unknown;
  socket?: {
    remoteAddress?: unknown;
  };
  requestContext?: MutableRequestContext;
}

export interface MiddlewareHttpResponse {
  setHeader(name: string, value: string | number): void;
}

export type MiddlewareNext = (error?: unknown) => void;
