export function pick<T extends object, K extends keyof T>(
  value: T,
  keys: readonly K[],
): Pick<T, K> {
  const result = {} as Pick<T, K>;

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      result[key] = value[key];
    }
  }

  return result;
}

export function omit<T extends object, K extends keyof T>(
  value: T,
  keys: readonly K[],
): Omit<T, K> {
  const excluded = new Set<keyof T>(keys);
  const result = {} as Omit<T, K>;

  for (const key of Object.keys(value) as Array<keyof T>) {
    if (!excluded.has(key)) {
      Object.assign(result, { [key]: value[key] });
    }
  }

  return result;
}

export function removeUndefined<T extends Record<string, unknown>>(
  value: T,
): Partial<T> {
  const result: Partial<T> = {};

  for (const [key, currentValue] of Object.entries(value)) {
    if (currentValue !== undefined) {
      Object.assign(result, { [key]: currentValue });
    }
  }

  return result;
}

export function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);

    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
  }

  return value;
}
