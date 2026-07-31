export type HeaderValue = string | readonly string[] | undefined;

export function normalizeIpAddress(value: string): string {
  const trimmed = value.trim();

  if (trimmed.startsWith('::ffff:')) {
    return trimmed.slice('::ffff:'.length);
  }

  return trimmed === '::1' ? '127.0.0.1' : trimmed;
}

export function getFirstForwardedIp(value: HeaderValue): string | null {
  const header = typeof value === 'string' ? value : value?.[0];

  if (!header) {
    return null;
  }

  const first = header.split(',')[0]?.trim();
  return first ? normalizeIpAddress(first) : null;
}

export function resolveClientIp(input: {
  forwardedFor?: HeaderValue;
  realIp?: HeaderValue;
  socketIp?: string;
}): string | null {
  const forwarded = getFirstForwardedIp(input.forwardedFor);

  if (forwarded) {
    return forwarded;
  }

  const realIp =
    typeof input.realIp === 'string' ? input.realIp : input.realIp?.[0];

  if (realIp) {
    return normalizeIpAddress(realIp);
  }

  return input.socketIp ? normalizeIpAddress(input.socketIp) : null;
}
