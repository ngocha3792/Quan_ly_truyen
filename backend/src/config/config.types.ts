import type { AppEnvironment } from '@/common/enums';

export interface AppConfig {
  environment: AppEnvironment;
  host: string;
  port: number;
  publicUrl: string;
  trustProxy: boolean;
  requestTimeoutMs: number;
  jsonBodyLimit: string;
  urlEncodedBodyLimit: string;
  swaggerEnabled: boolean;
  defaultLocale: string;
  supportedLocales: readonly string[];
}

export type AppLogLevel =
  'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';

export interface ObservabilityConfig {
  enabled: boolean;
  serviceName: string;
  serviceVersion: string;
  serviceInstanceId: string;
  log: {
    level: AppLogLevel;
    pretty: boolean;
    includeSource: boolean;
  };
  metrics: {
    enabled: boolean;
    path: '/internal/metrics';
    bearerToken?: string;
    collectDefaultMetrics: boolean;
    snapshotIntervalMs: number;
  };
}

export type AuthCookieSameSite = 'strict' | 'lax' | 'none';

export type JwtBlacklistFailureMode = 'closed' | 'open';

export interface AuthConfig {
  accessTokenSecret: string;
  refreshTokenSecret: string;

  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;

  issuer: string;
  audience: string;

  refreshCookie: {
    name: string;
    secure: boolean;
    sameSite: AuthCookieSameSite;
    domain?: string;
    path: string;
  };

  loginRateLimit: {
    enabled: boolean;
    windowSeconds: number;
    ipLimit: number;
    identifierLimit: number;
  };

  jwtBlacklist: {
    enabled: boolean;
    failureMode: JwtBlacklistFailureMode;
  };
  emailVerification: {
    resendCooldownSeconds: number;
  };
  passwordReset: {
    requestCooldownSeconds: number;
  };
}

export interface DatabaseConfig {
  url: string;
}

export interface CorsConfig {
  allowedOrigins: readonly string[];
  credentials: boolean;
  maxAgeSeconds: number;
}

export interface MaintenanceConfig {
  enabled: boolean;
  message: string;
  retryAfterSeconds: number;
  bypassHeaderName: string;
  bypassToken?: string;
  allowedPaths: readonly string[];
}

export interface RedisConfig {
  enabled: boolean;
  url: string;
  keyPrefix: string;
  connectTimeoutMs: number;
  commandTimeoutMs: number;
  cacheDefaultTtlSeconds: number;
}

export interface QueueConfig {
  enabled: boolean;
  prefix: string;
  defaultAttempts: number;
  defaultBackoffMs: number;
  workerConcurrency: number;

  outboxProcessingTimeoutMs: number;
  outboxBatchSize: number;
  outboxPollIntervalMs: number;
  outboxFailedAlertThreshold: number;

  workerHeartbeatEnabled: boolean;
  workerHeartbeatIntervalMs: number;
  workerHeartbeatTtlSeconds: number;

  workerRole: 'all' | 'queue' | 'cloudinary-webhook';
}

export interface IdempotencyConfig {
  failureMode: 'closed' | 'open';
  maxResponseBytes: number;
}

export interface InfrastructureFallbackConfig {
  allowInMemory: boolean;
  inMemoryStoreMaxEntries: number;
  inMemoryStoreSweepIntervalMs: number;
}

export interface MailConfig {
  enabled: boolean;
  fromName: string;
  fromAddress: string;
  replyTo?: string;
  frontendPublicUrl: string;
  messageIdDomain: string;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    requireTls: boolean;
    username?: string;
    password?: string;
    poolEnabled: boolean;
    maxConnections: number;
    maxMessages: number;
    rateLimitPerSecond: number;
    connectionTimeoutMs: number;
    greetingTimeoutMs: number;
    socketTimeoutMs: number;
    verifyOnStartup: boolean;
  };
  dkim: {
    enabled: boolean;
    domain?: string;
    selector?: string;
    privateKey?: string;
  };
}
