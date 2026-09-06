export function resolveProviderTimeoutMs(
  requested: number | undefined,
  fallback: number,
  maximum: number,
): number {
  if (
    requested === undefined ||
    !Number.isSafeInteger(requested) ||
    requested <= 0
  ) {
    return fallback;
  }

  return Math.min(requested, maximum);
}
