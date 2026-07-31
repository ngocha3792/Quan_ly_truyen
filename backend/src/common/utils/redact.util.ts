const DEFAULT_SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'currentpassword',
  'newpassword',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'cookie',
  'secret',
  'clientsecret',
]);

export interface RedactOptions {
  replacement?: string;
  sensitiveKeys?: readonly string[];
  maxDepth?: number;
}

export function redactSensitiveData(
  value: unknown,
  options: RedactOptions = {},
): unknown {
  const replacement = options.replacement ?? '[REDACTED]';
  const maxDepth = options.maxDepth ?? 8;
  const sensitiveKeys = new Set(
    (options.sensitiveKeys ?? [...DEFAULT_SENSITIVE_KEYS]).map((key) =>
      key.toLowerCase(),
    ),
  );

  return redact(value, sensitiveKeys, replacement, maxDepth, 0, new WeakSet());
}

function redact(
  value: unknown,
  sensitiveKeys: ReadonlySet<string>,
  replacement: string,
  maxDepth: number,
  depth: number,
  visited: WeakSet<object>,
): unknown {
  if (depth > maxDepth || value === null || typeof value !== 'object') {
    return value;
  }

  if (visited.has(value)) {
    return '[Circular]';
  }

  visited.add(value);

  if (Array.isArray(value)) {
    return value.map((item) =>
      redact(item, sensitiveKeys, replacement, maxDepth, depth + 1, visited),
    );
  }

  const result: Record<string, unknown> = {};

  for (const [key, nested] of Object.entries(value)) {
    result[key] = sensitiveKeys.has(key.toLowerCase())
      ? replacement
      : redact(
          nested,
          sensitiveKeys,
          replacement,
          maxDepth,
          depth + 1,
          visited,
        );
  }

  return result;
}
