import {
  DAY_IN_SECONDS,
  HOUR_IN_SECONDS,
  MINUTE_IN_SECONDS,
} from './time.constants';

export const CACHE_KEY_SEPARATOR = ':';
export const CACHE_SCHEMA_VERSION = 'v1';

export const CACHE_TTL_SECONDS = {
  VERY_SHORT: 30,
  SHORT: MINUTE_IN_SECONDS,
  DEFAULT: 5 * MINUTE_IN_SECONDS,
  MEDIUM: 15 * MINUTE_IN_SECONDS,
  LONG: HOUR_IN_SECONDS,
  DAY: DAY_IN_SECONDS,
} as const;

/**
 * Builds deterministic technical cache keys.
 * Feature-specific prefixes still belong to their owning module.
 */
export function joinCacheKey(...parts: ReadonlyArray<string | number>): string {
  return parts
    .map((part) => String(part).trim())
    .filter((part) => part.length > 0)
    .join(CACHE_KEY_SEPARATOR);
}
