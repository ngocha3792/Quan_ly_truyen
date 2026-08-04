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

  csrf: {
    enabled: boolean;

    /**
     * HMAC secret riêng, không dùng chung JWT secret.
     */
    secret: string;

    /**
     * Cookie này không HttpOnly vì frontend cần đọc
     * để gửi lại qua X-CSRF-Token.
     */
    cookieName: string;

    /**
     * Có thể khác AUTH_COOKIE_DOMAIN.
     *
     * Ví dụ:
     * frontend: app.example.com
     * backend: api.example.com
     *
     * Có thể đặt .example.com cho CSRF cookie,
     * trong khi refresh cookie vẫn là host-only.
     */
    cookieDomain?: string;

    /**
     * Phải là "/" để frontend đọc được cookie
     * tại mọi route.
     */
    cookiePath: string;
  };
  accessAuthorizationCache?: {
    /**
     * Chỉ cache role, permission và authorProfileId.
     *
     * Trạng thái session/version vẫn đọc trực tiếp từ DB.
     */
    enabled: boolean;

    /**
     * TTL ngắn để hạn chế stale authorization.
     */
    ttlSeconds: number;
  };
  sessions: {
    /**
     * Số session còn hoạt động tối đa trên mỗi user.
     */
    maxActiveSessions: number;

    /**
     * Số session tối đa trả về từ /auth/sessions.
     */
    listLimit: number;
  };

  audit: {
    /**
     * Số security event tối đa trả về mỗi request.
     */
    historyLimit: number;
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

  adminMfa: {
    enabled: boolean;
    issuer: string;
    encryptionKeyBase64?: string;
    preAuthTicketTtlSeconds: number;
    maxVerificationAttempts: number;
    totpWindow: number;
    recoveryCodeCount: number;
  };

  oauth: {
    enabled: boolean;
    stateTtlSeconds: number;
    stateCookieName: string;
    google: {
      enabled: boolean;
      clientId?: string;
      clientSecret?: string;
      callbackUrl?: string;
    };
    github: {
      enabled: boolean;
      clientId?: string;
      clientSecret?: string;
      callbackUrl?: string;
    };
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

  mailJobRetention: {
    completedAgeSeconds: number;
    completedCount: number;

    failedAgeSeconds: number;
    failedCount: number;
  };

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

  payloadEncryption: {
    /**
     * Base64 encoding của key 32 bytes.
     */
    keyBase64?: string;

    /**
     * Chỉ dùng trong giai đoạn chuyển đổi.
     */
    allowLegacyPlaintextRead: boolean;
  };
}
export interface ProductionGateConfig {
  /**
   * Folder chứa Prisma migration trong image production.
   *
   * Docker image bắt buộc phải copy folder này.
   */
  migrationsPath: string;

  /**
   * Cleanup phải có một lần chạy thành công
   * không cũ hơn số giờ này.
   */
  cleanupMaxAgeHours: number;
}
