import { registerAs } from '@nestjs/config';

import type {
  AuthConfig,
  AuthCookieSameSite,
  JwtBlacklistFailureMode,
} from './config.types';

export const AUTH_CONFIG_KEY = 'auth';

function parseBoolean(
  value: string | undefined,
  defaultValue: boolean,
): boolean {
  if (value === undefined) {
    return defaultValue;
  }

  return value.trim().toLowerCase() === 'true';
}

function optionalString(value: string | undefined): string | undefined {
  const normalized = value?.trim();

  return normalized || undefined;
}

export default registerAs(AUTH_CONFIG_KEY, (): AuthConfig => ({
  accessTokenSecret: process.env.JWT_ACCESS_SECRET ?? '',

  refreshTokenSecret: process.env.JWT_REFRESH_SECRET ?? '',

  accessTokenTtlSeconds: Number(process.env.JWT_ACCESS_TTL_SECONDS ?? 900),

  refreshTokenTtlSeconds: Number(
    process.env.JWT_REFRESH_TTL_SECONDS ?? 2_592_000,
  ),

  issuer: process.env.JWT_ISSUER ?? 'quan-ly-truyen-api',

  audience: process.env.JWT_AUDIENCE ?? 'quan-ly-truyen-web',

  refreshCookie: {
    name: process.env.AUTH_REFRESH_COOKIE_NAME ?? 'refresh_token',

    secure: parseBoolean(process.env.AUTH_COOKIE_SECURE, false),

    sameSite: (process.env.AUTH_COOKIE_SAME_SITE ??
      'lax') as AuthCookieSameSite,

    domain: optionalString(process.env.AUTH_COOKIE_DOMAIN),

    path: process.env.AUTH_COOKIE_PATH ?? '/api/v1/auth',
  },

  loginRateLimit: {
    enabled: parseBoolean(process.env.AUTH_LOGIN_RATE_LIMIT_ENABLED, false),

    windowSeconds: Number(
      process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_SECONDS ?? 900,
    ),

    ipLimit: Number(process.env.AUTH_LOGIN_RATE_LIMIT_IP_LIMIT ?? 20),

    identifierLimit: Number(
      process.env.AUTH_LOGIN_RATE_LIMIT_IDENTIFIER_LIMIT ?? 5,
    ),
  },

  jwtBlacklist: {
    enabled: parseBoolean(process.env.AUTH_JWT_BLACKLIST_ENABLED, false),

    failureMode: (process.env.AUTH_JWT_BLACKLIST_FAILURE_MODE ??
      'closed') as JwtBlacklistFailureMode,
  },
  emailVerification: {
    resendCooldownSeconds: Number(
      process.env.AUTH_EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS ?? 60,
    ),
  },
  passwordReset: {
    requestCooldownSeconds: Number(
      process.env.AUTH_PASSWORD_RESET_REQUEST_COOLDOWN_SECONDS ?? 60,
    ),
  },
  csrf: {
    enabled: parseBoolean(process.env.AUTH_CSRF_ENABLED, false),

    secret: process.env.AUTH_CSRF_SECRET ?? '',

    cookieName: process.env.AUTH_CSRF_COOKIE_NAME ?? 'csrf_token',

    cookieDomain: optionalString(process.env.AUTH_CSRF_COOKIE_DOMAIN),

    cookiePath: process.env.AUTH_CSRF_COOKIE_PATH ?? '/',
  },
  sessions: {
    maxActiveSessions: Number(process.env.AUTH_MAX_ACTIVE_SESSIONS ?? 10),

    listLimit: Number(process.env.AUTH_SESSION_LIST_LIMIT ?? 20),
  },

  audit: {
    historyLimit: Number(process.env.AUTH_SECURITY_EVENT_HISTORY_LIMIT ?? 50),
  },
}));
