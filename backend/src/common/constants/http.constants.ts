export const HTTP_HEADERS = {
  AUTHORIZATION: 'authorization',
  CONTENT_TYPE: 'content-type',
  ACCEPT_LANGUAGE: 'accept-language',
  CONTENT_LANGUAGE: 'content-language',
  USER_AGENT: 'user-agent',
  X_FORWARDED_FOR: 'x-forwarded-for',
  X_REAL_IP: 'x-real-ip',
  REQUEST_ID: 'x-request-id',
  CORRELATION_ID: 'x-correlation-id',
  IDEMPOTENCY_KEY: 'idempotency-key',
  RETRY_AFTER: 'retry-after',
} as const;

export const CONTENT_TYPES = {
  JSON: 'application/json',
  JSON_UTF8: 'application/json; charset=utf-8',
  OCTET_STREAM: 'application/octet-stream',
  SERVER_SENT_EVENTS: 'text/event-stream',
  FORM_URLENCODED: 'application/x-www-form-urlencoded',
  MULTIPART_FORM_DATA: 'multipart/form-data',
} as const;

export const REQUEST_PROPERTIES = {
  AUTH_PRINCIPAL: 'user',
  REQUEST_ID: 'requestId',
  CORRELATION_ID: 'correlationId',
  REQUEST_CONTEXT: 'requestContext',
} as const;

export const MAX_REQUEST_ID_LENGTH = 128;
export const MAX_CORRELATION_ID_LENGTH = 128;
export const MAX_IDEMPOTENCY_KEY_LENGTH = 128;
