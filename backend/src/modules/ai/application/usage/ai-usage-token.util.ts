const MAX_DATABASE_TOKEN_COUNT = 2_147_483_647;

export function normalizeAiUsageToken(
  value: number | undefined,
): number | undefined {
  return value !== undefined &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MAX_DATABASE_TOKEN_COUNT
    ? value
    : undefined;
}
