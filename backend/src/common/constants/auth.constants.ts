export const AUTH_SCHEMES = {
  BEARER: 'Bearer',
} as const;

export const AUTH_STRATEGIES = {
  LOCAL: 'local',
  JWT_ACCESS: 'jwt-access',
  JWT_REFRESH: 'jwt-refresh',
  OPTIONAL_JWT: 'optional-jwt',
} as const;

export const AUTH_COOKIES = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
} as const;

export const AUTH_TOKEN_TYPES = {
  ACCESS: 'access',
  REFRESH: 'refresh',
} as const;

/**
 * Names only. Cookie security flags and expiration must be supplied by config.
 */
export type AuthStrategy =
  (typeof AUTH_STRATEGIES)[keyof typeof AUTH_STRATEGIES];
