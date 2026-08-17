export type SafeAuditPrimitive = string | number | boolean | null;
export type SafeAuditValue =
  | SafeAuditPrimitive
  | readonly SafeAuditValue[]
  | { readonly [key: string]: SafeAuditValue };

export interface AuditSanitizerLimits {
  readonly maxDepth: number;
  readonly maxArrayItems: number;
  readonly maxObjectKeys: number;
  readonly maxStringLength: number;
}

export const DEFAULT_AUDIT_SANITIZER_LIMITS: AuditSanitizerLimits = {
  maxDepth: 8,
  maxArrayItems: 100,
  maxObjectKeys: 100,
  maxStringLength: 2_000,
};

const REDACTED = '[REDACTED]';
const TRUNCATED = '[TRUNCATED]';

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'passworddigest',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'sessiontoken',
  'authorization',
  'cookie',
  'setcookie',
  'mfasecret',
  'totpsecret',
  'otpsecret',
  'recoverycode',
  'recoverycodes',
  'verificationtoken',
  'emailverificationtoken',
  'resettoken',
  'passwordresettoken',
  'apikey',
  'apisecret',
  'privatekey',
  'clientsecret',
  'csrftoken',
]);

function normalizeSensitiveKey(key: string): string {
  return key.toLowerCase().replaceAll(/[^a-z0-9]/g, '');
}

function isSensitiveKey(key: string): boolean {
  const normalized = normalizeSensitiveKey(key);
  return (
    SENSITIVE_KEYS.has(normalized) ||
    /password|token|secret|credential|privatekey|authorization|cookie/.test(
      normalized,
    )
  );
}

function sanitizeString(value: string, maxLength: number): string {
  const trimmed =
    value.length > maxLength
      ? `${value.slice(0, maxLength)}…${TRUNCATED}`
      : value;

  if (/^\s*(?:Bearer|Basic)\s+\S+/i.test(trimmed)) {
    return REDACTED;
  }

  if (
    /^[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}$/.test(trimmed)
  ) {
    return REDACTED;
  }

  return trimmed;
}

function sanitizeInternal(
  value: unknown,
  limits: AuditSanitizerLimits,
  depth: number,
): SafeAuditValue {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string')
    return sanitizeString(value, limits.maxStringLength);
  if (typeof value === 'number')
    return Number.isFinite(value) ? value : String(value);
  if (typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();

  if (depth >= limits.maxDepth) return TRUNCATED;

  if (Array.isArray(value)) {
    const items = value
      .slice(0, limits.maxArrayItems)
      .map((item) => sanitizeInternal(item, limits, depth + 1));
    if (value.length > limits.maxArrayItems) items.push(TRUNCATED);
    return items;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    const output = Object.create(null) as Record<string, SafeAuditValue>;

    for (const [key, nested] of entries.slice(0, limits.maxObjectKeys)) {
      output[key] = isSensitiveKey(key)
        ? REDACTED
        : sanitizeInternal(nested, limits, depth + 1);
    }

    if (entries.length > limits.maxObjectKeys) output.__truncated__ = TRUNCATED;
    return output;
  }

  if (typeof value === 'symbol' || typeof value === 'function') {
    return sanitizeString(value.toString(), limits.maxStringLength);
  }

  return null;
}

export function sanitizeAuditPayload(
  value: unknown,
  limits: AuditSanitizerLimits = DEFAULT_AUDIT_SANITIZER_LIMITS,
): SafeAuditValue {
  return sanitizeInternal(value, limits, 0);
}

export function maskAuditIpAddress(
  value: string | null | undefined,
): string | null {
  if (!value) return null;

  const ipv4 = value.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) return `${ipv4[1]}.${ipv4[2]}.${ipv4[3]}.xxx`;

  if (value.includes(':')) {
    const segments = value.split(':');
    const kept = segments.slice(0, 4).join(':');
    return `${kept}${kept.endsWith(':') ? '' : ':'}xxxx:xxxx:xxxx:xxxx`;
  }

  return '[MASKED]';
}

export function sanitizeAuditUserAgent(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  return value.length <= 512 ? value : `${value.slice(0, 512)}…${TRUNCATED}`;
}

export const AUDIT_REDACTED_VALUE = REDACTED;
