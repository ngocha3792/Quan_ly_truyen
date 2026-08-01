import { sanitizeCredentialUrls } from '@/common/utils';

import { REDACTED_LOG_VALUE } from './logging.constants';

const MAX_DEPTH = 8;
const MAX_KEYS = 100;
const MAX_STRING_LENGTH = 8192;
const MAX_STACK_LENGTH = 16_384;

const SENSITIVE_KEY_PATTERN =
  /(?:password|passphrase|credential|authorization|cookie|secret|access.?token|refresh.?token|reset.?token|verification.?token|idempotency.?key|private.?key|raw.?body|email.?body|signed.?url|signature)/i;

export interface SanitizedLogError {
  type: string;
  message: string;
  stack?: string;
}

export function sanitizeLogValue(value: unknown): unknown {
  return sanitizeValue(value, 0, new WeakSet<object>());
}

export function sanitizeLogError(error: Error): SanitizedLogError {
  return {
    type: error.name || 'Error',
    message: sanitizeString(error.message, MAX_STRING_LENGTH),
    ...(error.stack
      ? { stack: sanitizeString(error.stack, MAX_STACK_LENGTH) }
      : {}),
  };
}

function sanitizeValue(
  value: unknown,
  depth: number,
  seen: WeakSet<object>,
): unknown {
  if (typeof value === 'string') {
    return sanitizeString(value, MAX_STRING_LENGTH);
  }

  if (
    value === null ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return sanitizeLogError(value);
  }

  if (value === undefined) return 'undefined';
  if (typeof value === 'symbol') return value.description ?? '[SYMBOL]';
  if (typeof value === 'function')
    return `[FUNCTION:${value.name || 'anonymous'}]`;
  if (typeof value !== 'object') return '[UNSUPPORTED]';

  if (depth >= MAX_DEPTH) {
    return '[MAX_DEPTH]';
  }

  if (seen.has(value)) {
    return '[CIRCULAR]';
  }
  seen.add(value);

  if (Array.isArray(value)) {
    const result = value
      .slice(0, MAX_KEYS)
      .map((entry) => sanitizeValue(entry, depth + 1, seen));
    seen.delete(value);
    return result;
  }

  const result: Record<string, unknown> = {};
  const entries = Object.entries(value).slice(0, MAX_KEYS);
  for (const [key, entry] of entries) {
    result[key] = SENSITIVE_KEY_PATTERN.test(key)
      ? REDACTED_LOG_VALUE
      : sanitizeValue(entry, depth + 1, seen);
  }
  seen.delete(value);
  return result;
}

function sanitizeString(value: string, maxLength: number): string {
  return sanitizeCredentialUrls(value).slice(0, maxLength);
}
