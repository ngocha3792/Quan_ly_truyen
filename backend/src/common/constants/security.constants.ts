/**
 * Generic transport/security limits.
 * Product password policy belongs to auth.
 */
export const SECURITY_LIMITS = {
  MAX_BEARER_TOKEN_LENGTH: 8_192,

  MAX_USER_AGENT_LENGTH: 1_024,

  MAX_IP_ADDRESS_LENGTH: 64,

  MAX_CSRF_TOKEN_LENGTH: 1_024,
} as const;

export const CSRF_HEADER_NAME = 'x-csrf-token' as const;

export const REDACTED_VALUE = '[REDACTED]';

export const SENSITIVE_FIELD_NAMES = [
  'password',
  'passwordHash',
  'currentPassword',
  'newPassword',

  'accessToken',
  'refreshToken',
  'csrfToken',

  'authorization',
  'cookie',
  'x-csrf-token',

  'secret',
  'clientSecret',
] as const;
