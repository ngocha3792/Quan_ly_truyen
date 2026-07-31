export function chunkArray<T>(values: readonly T[], size: number): T[][] {
  if (!Number.isSafeInteger(size) || size < 1) {
    throw new RangeError('size phải là số nguyên dương');
  }

  const result: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }

  return result;
}

export function uniqueValues<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

export function uniqueBy<T, TKey>(
  values: readonly T[],
  selector: (value: T) => TKey,
): T[] {
  const seen = new Set<TKey>();
  const result: T[] = [];

  for (const value of values) {
    const key = selector(value);

    if (!seen.has(key)) {
      seen.add(key);
      result.push(value);
    }
  }

  return result;
}

export function groupBy<T, TKey extends PropertyKey>(
  values: readonly T[],
  selector: (value: T) => TKey,
): Record<TKey, T[]> {
  const result = {} as Record<TKey, T[]>;

  for (const value of values) {
    const key = selector(value);
    (result[key] ??= []).push(value);
  }

  return result;
}
