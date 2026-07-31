import { randomUUID } from 'node:crypto';

import {
  DEFAULT_SUPPORTED_LOCALES,
  SAFE_EXTERNAL_ID_PATTERN,
} from './common-middlewares.constants';
import type {
  LocaleMiddlewareOptions,
  RequestContextMiddlewareOptions,
} from './common-middlewares-options.interface';
import type {
  MiddlewareHttpRequest,
  MutableRequestContext,
} from './request-context.interface';

const DEFAULT_MAX_EXTERNAL_ID_LENGTH = 128;

export function nonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
}

export function readHeader(headers: unknown, name: string): string | undefined {
  if (!headers || typeof headers !== 'object') {
    return undefined;
  }

  const container = headers as {
    get?: (headerName: string) => unknown;
    [key: string]: unknown;
  };

  if (typeof container.get === 'function') {
    return nonEmptyString(container.get(name));
  }

  const value = container[name] ?? container[name.toLowerCase()];

  if (Array.isArray(value)) {
    return nonEmptyString(value[0]);
  }

  return nonEmptyString(value);
}

export function sanitizeExternalId(
  value: unknown,
  maxLength = DEFAULT_MAX_EXTERNAL_ID_LENGTH,
): string | undefined {
  const text = nonEmptyString(value);

  if (
    !text ||
    text.length > maxLength ||
    !SAFE_EXTERNAL_ID_PATTERN.test(text)
  ) {
    return undefined;
  }

  return text;
}

function resolveIpAddress(request: MiddlewareHttpRequest): string | undefined {
  return (
    nonEmptyString(request.ip) ?? nonEmptyString(request.socket?.remoteAddress)
  );
}

export function createRequestContext(
  request: MiddlewareHttpRequest,
  options: RequestContextMiddlewareOptions = {},
): MutableRequestContext {
  const maxLength =
    options.maxExternalIdLength ?? DEFAULT_MAX_EXTERNAL_ID_LENGTH;

  const requestId =
    sanitizeExternalId(request.requestId, maxLength) ??
    sanitizeExternalId(request.id, maxLength) ??
    (options.trustIncomingRequestId === false
      ? undefined
      : sanitizeExternalId(
          readHeader(request.headers, 'x-request-id'),
          maxLength,
        )) ??
    randomUUID();

  const correlationId =
    sanitizeExternalId(request.correlationId, maxLength) ??
    (options.trustIncomingCorrelationId === false
      ? undefined
      : sanitizeExternalId(
          readHeader(request.headers, 'x-correlation-id'),
          maxLength,
        )) ??
    requestId;

  const ipAddress = resolveIpAddress(request);
  const userAgent = readHeader(request.headers, 'user-agent');

  return {
    requestId,
    correlationId,
    method: nonEmptyString(request.method) ?? 'UNKNOWN',
    path:
      nonEmptyString(request.originalUrl) ?? nonEmptyString(request.url) ?? '/',
    startedAt: new Date(),
    ...(ipAddress ? { ipAddress } : {}),
    ...(userAgent ? { userAgent } : {}),
  };
}

interface ParsedLanguage {
  tag: string;
  quality: number;
  index: number;
}

function parseAcceptLanguage(value: string): ParsedLanguage[] {
  return value
    .split(',')
    .map((part, index) => {
      const [rawTag, ...parameters] = part.split(';');
      const tag = rawTag?.trim() ?? '';
      const qualityParameter = parameters
        .map((parameter) => parameter.trim())
        .find((parameter) => parameter.startsWith('q='));
      const quality = qualityParameter ? Number(qualityParameter.slice(2)) : 1;

      return {
        tag,
        quality:
          Number.isFinite(quality) && quality >= 0 ? Math.min(quality, 1) : 0,
        index,
      };
    })
    .filter((item) => item.tag.length > 0)
    .sort(
      (left, right) => right.quality - left.quality || left.index - right.index,
    );
}

function matchSupportedLocale(
  requestedTag: string,
  supportedLocales: readonly string[],
): string | undefined {
  const normalized = requestedTag.toLowerCase();

  const exact = supportedLocales.find(
    (locale) => locale.toLowerCase() === normalized,
  );

  if (exact) {
    return exact;
  }

  const language = normalized.split('-')[0];

  if (!language) {
    return undefined;
  }

  return supportedLocales.find(
    (locale) => locale.toLowerCase().split('-')[0] === language,
  );
}

export function resolveLocale(
  acceptLanguageHeader: string | undefined,
  options: LocaleMiddlewareOptions = {},
): string {
  const supportedLocales =
    options.supportedLocales ?? DEFAULT_SUPPORTED_LOCALES;
  const defaultLocale = options.defaultLocale ?? supportedLocales[0] ?? 'vi-VN';

  if (!acceptLanguageHeader) {
    return defaultLocale;
  }

  for (const requested of parseAcceptLanguage(acceptLanguageHeader)) {
    if (requested.tag === '*') {
      return defaultLocale;
    }

    const matched = matchSupportedLocale(requested.tag, supportedLocales);

    if (matched) {
      return matched;
    }
  }

  return defaultLocale;
}

export function isJsonContentType(
  value: string,
  allowVendorJson = true,
): boolean {
  const mediaType = value.split(';', 1)[0]?.trim().toLowerCase();

  if (mediaType === 'application/json') {
    return true;
  }

  return (
    allowVendorJson &&
    typeof mediaType === 'string' &&
    mediaType.startsWith('application/') &&
    mediaType.endsWith('+json')
  );
}

export function requestHasBody(request: MiddlewareHttpRequest): boolean {
  const contentLength = readHeader(request.headers, 'content-length');
  const transferEncoding = readHeader(request.headers, 'transfer-encoding');

  if (transferEncoding) {
    return true;
  }

  if (!contentLength) {
    return false;
  }

  const parsedLength = Number(contentLength);

  return Number.isFinite(parsedLength) ? parsedLength > 0 : true;
}
