/**
 * Generic transport/security limits. Product password policy belongs to auth.
 */
export const SECURITY_LIMITS = {
  MAX_BEARER_TOKEN_LENGTH: 8_192,
  MAX_USER_AGENT_LENGTH: 1_024,
  MAX_IP_ADDRESS_LENGTH: 64,
} as const;

export const REDACTED_VALUE = '[REDACTED]';

export const SENSITIVE_FIELD_NAMES = [
  'password',
  'passwordHash',
  'currentPassword',
  'newPassword',
  'accessToken',
  'refreshToken',
  'authorization',
  'cookie',
  'secret',
  'clientSecret',
] as const;
