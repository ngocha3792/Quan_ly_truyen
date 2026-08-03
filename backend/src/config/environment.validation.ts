import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
  Max,
  Min,
  validateSync,
} from 'class-validator';

import { AppEnvironment } from '@/common/enums';

function parseBooleanValue(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value !== 'string') {
    throw new Error(`Expected boolean string, received ${typeof value}`);
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === 'true') {
    return true;
  }

  if (normalized === 'false') {
    return false;
  }

  throw new Error(`Expected "true" or "false", received "${value}"`);
}

function parseIntegerValue(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    throw new Error(`Expected integer, received "${String(value)}"`);
  }

  return parsed;
}

export class EnvironmentVariables {
  @IsEnum(AppEnvironment)
  NODE_ENV: AppEnvironment = AppEnvironment.DEVELOPMENT;

  @IsString()
  @IsNotEmpty()
  HOST = '0.0.0.0';

  @Transform(({ value }) => parseIntegerValue(value ?? 3000))
  @IsInt()
  @Min(1)
  @Max(65_535)
  PORT = 3000;

  @IsUrl({ require_tld: false })
  APP_PUBLIC_URL = 'http://localhost:3000';

  @Transform(({ value }) => parseBooleanValue(value ?? false))
  @IsBoolean()
  TRUST_PROXY = false;

  @Transform(({ value }) => parseIntegerValue(value ?? 15_000))
  @IsInt()
  @Min(100)
  @Max(120_000)
  HTTP_REQUEST_TIMEOUT_MS = 15_000;

  @IsString()
  @IsNotEmpty()
  JSON_BODY_LIMIT = '2mb';

  @IsString()
  @IsNotEmpty()
  URL_ENCODED_BODY_LIMIT = '2mb';

  @Transform(({ value }) => parseBooleanValue(value ?? false))
  @IsBoolean()
  SWAGGER_ENABLED = false;

  @IsString()
  @IsNotEmpty()
  DEFAULT_LOCALE = 'vi-VN';

  @IsString()
  @IsNotEmpty()
  SUPPORTED_LOCALES = 'vi-VN,en-US';

  @Transform(({ value }) => parseBooleanValue(value ?? true))
  @IsBoolean()
  OBSERVABILITY_ENABLED = true;

  @IsEnum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
  LOG_LEVEL:
    'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent' = 'info';

  @Transform(({ value }) => parseBooleanValue(value ?? false))
  @IsBoolean()
  LOG_PRETTY = false;

  @Transform(({ value }) => parseBooleanValue(value ?? false))
  @IsBoolean()
  LOG_INCLUDE_SOURCE = false;

  @Transform(({ value }) => parseBooleanValue(value ?? true))
  @IsBoolean()
  METRICS_ENABLED = true;

  @IsString()
  @IsNotEmpty()
  METRICS_PATH = '/internal/metrics';

  @IsOptional()
  @IsString()
  METRICS_BEARER_TOKEN?: string;

  @Transform(({ value }) => parseBooleanValue(value ?? true))
  @IsBoolean()
  METRICS_DEFAULT_ENABLED = true;

  @Transform(({ value }) => parseIntegerValue(value ?? 10_000))
  @IsInt()
  @Min(5000)
  @Max(60_000)
  METRICS_SNAPSHOT_INTERVAL_MS = 10_000;

  @IsString()
  @IsNotEmpty()
  CORS_ALLOWED_ORIGINS = 'http://localhost:4200';

  @Transform(({ value }) => parseBooleanValue(value ?? true))
  @IsBoolean()
  CORS_CREDENTIALS = true;

  @Transform(({ value }) => parseIntegerValue(value ?? 86_400))
  @IsInt()
  @Min(0)
  CORS_MAX_AGE_SECONDS = 86_400;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(32)
  JWT_ACCESS_SECRET!: string;
  @IsString()
  @IsNotEmpty()
  @MinLength(32)
  JWT_REFRESH_SECRET!: string;

  @Transform(({ value }) => parseIntegerValue(value ?? 900))
  @IsInt()
  @Min(60)
  @Max(3600)
  JWT_ACCESS_TTL_SECONDS = 900;

  @Transform(({ value }) => parseIntegerValue(value ?? 2_592_000))
  @IsInt()
  @Min(3600)
  @Max(7_776_000)
  JWT_REFRESH_TTL_SECONDS = 2_592_000;

  @IsString()
  @IsNotEmpty()
  JWT_ISSUER = 'quan-ly-truyen-api';

  @IsString()
  @IsNotEmpty()
  JWT_AUDIENCE = 'quan-ly-truyen-web';
  @IsString()
  @IsNotEmpty()
  AUTH_REFRESH_COOKIE_NAME = 'refresh_token';

  @Transform(({ value }) => parseBooleanValue(value ?? false))
  @IsBoolean()
  AUTH_COOKIE_SECURE = false;

  @Transform(({ value }) => parseBooleanValue(value ?? false))
  @IsBoolean()
  AUTH_ACCESS_AUTHORIZATION_CACHE_ENABLED = false;

  @Transform(({ value }) => parseIntegerValue(value ?? 15))
  @IsInt()
  @Min(1)
  @Max(60)
  AUTH_ACCESS_AUTHORIZATION_CACHE_TTL_SECONDS = 15;

  @IsIn(['strict', 'lax', 'none'])
  AUTH_COOKIE_SAME_SITE: 'strict' | 'lax' | 'none' = 'lax';

  @IsOptional()
  @IsString()
  AUTH_COOKIE_DOMAIN?: string;

  @IsString()
  @IsNotEmpty()
  AUTH_COOKIE_PATH = '/api/v1/auth';
  @Transform(({ value }) => parseBooleanValue(value ?? false))
  @IsBoolean()
  AUTH_CSRF_ENABLED = false;

  @IsOptional()
  @IsString()
  @MinLength(32)
  AUTH_CSRF_SECRET?: string;

  @IsString()
  @IsNotEmpty()
  AUTH_CSRF_COOKIE_NAME = 'csrf_token';

  @IsOptional()
  @IsString()
  AUTH_CSRF_COOKIE_DOMAIN?: string;

  @IsString()
  @IsNotEmpty()
  AUTH_CSRF_COOKIE_PATH = '/';

  @Transform(({ value }) => parseBooleanValue(value ?? false))
  @IsBoolean()
  AUTH_LOGIN_RATE_LIMIT_ENABLED = false;

  @Transform(({ value }) => parseIntegerValue(value ?? 900))
  @IsInt()
  @Min(60)
  @Max(86_400)
  AUTH_LOGIN_RATE_LIMIT_WINDOW_SECONDS = 900;

  @Transform(({ value }) => parseIntegerValue(value ?? 20))
  @IsInt()
  @Min(1)
  @Max(10_000)
  AUTH_LOGIN_RATE_LIMIT_IP_LIMIT = 20;

  @Transform(({ value }) => parseIntegerValue(value ?? 5))
  @IsInt()
  @Min(1)
  @Max(1000)
  AUTH_LOGIN_RATE_LIMIT_IDENTIFIER_LIMIT = 5;

  @Transform(({ value }) => parseBooleanValue(value ?? false))
  @IsBoolean()
  AUTH_JWT_BLACKLIST_ENABLED = false;

  @IsIn(['closed', 'open'])
  AUTH_JWT_BLACKLIST_FAILURE_MODE: 'closed' | 'open' = 'closed';

  @Transform(({ value }) => parseBooleanValue(value ?? false))
  @IsBoolean()
  MAINTENANCE_MODE = false;

  @IsString()
  @IsNotEmpty()
  MAINTENANCE_MESSAGE = 'Hệ thống đang bảo trì';

  @Transform(({ value }) => parseIntegerValue(value ?? 300))
  @IsInt()
  @Min(0)
  MAINTENANCE_RETRY_AFTER_SECONDS = 300;

  @IsString()
  @IsNotEmpty()
  MAINTENANCE_BYPASS_HEADER = 'x-maintenance-key';

  @IsOptional()
  @IsString()
  MAINTENANCE_BYPASS_TOKEN?: string;

  @Transform(({ value }) => parseBooleanValue(value ?? false))
  @IsBoolean()
  REDIS_ENABLED = false;

  @IsString()
  @IsNotEmpty()
  REDIS_URL = 'redis://localhost:6379';

  @IsString()
  @IsNotEmpty()
  REDIS_KEY_PREFIX = 'qlt';

  @Transform(({ value }) => parseIntegerValue(value ?? 5000))
  @IsInt()
  @Min(100)
  REDIS_CONNECT_TIMEOUT_MS = 5000;

  @Transform(({ value }) => parseIntegerValue(value ?? 3000))
  @IsInt()
  @Min(100)
  REDIS_COMMAND_TIMEOUT_MS = 3000;

  @Transform(({ value }) => parseIntegerValue(value ?? 300))
  @IsInt()
  @Min(1)
  CACHE_DEFAULT_TTL_SECONDS = 300;

  @Transform(({ value }) => parseBooleanValue(value ?? false))
  @IsBoolean()
  QUEUE_ENABLED = false;

  @IsString()
  @IsNotEmpty()
  QUEUE_PREFIX = 'qlt';

  @Transform(({ value }) => parseIntegerValue(value ?? 3))
  @IsInt()
  @Min(1)
  @Max(20)
  QUEUE_DEFAULT_ATTEMPTS = 3;

  @Transform(({ value }) => parseIntegerValue(value ?? 5000))
  @IsInt()
  @Min(100)
  QUEUE_DEFAULT_BACKOFF_MS = 5000;

  @Transform(({ value }) => parseIntegerValue(value ?? 5))
  @IsInt()
  @Min(1)
  @Max(50)
  WORKER_CONCURRENCY = 5;

  @Transform(({ value }) => parseIntegerValue(value ?? 60_000))
  @IsInt()
  @Min(10_000)
  OUTBOX_PROCESSING_TIMEOUT_MS = 60_000;

  @Transform(({ value }) => parseIntegerValue(value ?? 50))
  @IsInt()
  @Min(1)
  @Max(500)
  OUTBOX_BATCH_SIZE = 50;

  @Transform(({ value }) => parseIntegerValue(value ?? 10_000))
  @IsInt()
  @Min(1000)
  OUTBOX_POLL_INTERVAL_MS = 10_000;

  @Transform(({ value }) => parseIntegerValue(value ?? 5))
  @IsInt()
  @Min(1)
  @Max(1000)
  OUTBOX_FAILED_ALERT_THRESHOLD = 5;

  @Transform(({ value }) => parseIntegerValue(value ?? 10))
  @IsInt()
  @Min(1)
  @Max(50)
  AUTH_MAX_ACTIVE_SESSIONS = 10;

  @Transform(({ value }) => parseIntegerValue(value ?? 20))
  @IsInt()
  @Min(1)
  @Max(100)
  AUTH_SESSION_LIST_LIMIT = 20;

  @Transform(({ value }) => parseIntegerValue(value ?? 50))
  @IsInt()
  @Min(1)
  @Max(100)
  AUTH_SECURITY_EVENT_HISTORY_LIMIT = 50;

  @Transform(({ value }) => parseIntegerValue(value ?? 3600))
  @IsInt()
  @Min(60)
  @Max(604_800)
  MAIL_QUEUE_COMPLETED_RETENTION_SECONDS = 3600;

  @Transform(({ value }) => parseIntegerValue(value ?? 100))
  @IsInt()
  @Min(1)
  @Max(1000)
  MAIL_QUEUE_COMPLETED_RETENTION_COUNT = 100;

  @Transform(({ value }) => parseIntegerValue(value ?? 604_800))
  @IsInt()
  @Min(3600)
  @Max(2_592_000)
  MAIL_QUEUE_FAILED_RETENTION_SECONDS = 604_800;

  @Transform(({ value }) => parseIntegerValue(value ?? 1000))
  @IsInt()
  @Min(1)
  @Max(10_000)
  MAIL_QUEUE_FAILED_RETENTION_COUNT = 1000;

  @Transform(({ value }) => parseBooleanValue(value ?? true))
  @IsBoolean()
  QUEUE_WORKER_HEARTBEAT_ENABLED = true;

  @Transform(({ value }) => parseIntegerValue(value ?? 10_000))
  @IsInt()
  @Min(1000)
  @Max(60_000)
  QUEUE_WORKER_HEARTBEAT_INTERVAL_MS = 10_000;

  @Transform(({ value }) => parseIntegerValue(value ?? 30))
  @IsInt()
  @Min(5)
  @Max(300)
  QUEUE_WORKER_HEARTBEAT_TTL_SECONDS = 30;

  @IsEnum(['all', 'queue', 'cloudinary-webhook'])
  WORKER_ROLE: 'all' | 'queue' | 'cloudinary-webhook' = 'all';

  @IsEnum(['closed', 'open'])
  IDEMPOTENCY_FAILURE_MODE: 'closed' | 'open' = 'closed';

  @Transform(({ value }) => parseBooleanValue(value ?? false))
  @IsBoolean()
  ALLOW_IN_MEMORY_INFRASTRUCTURE_FALLBACK = false;

  @Transform(({ value }) => parseIntegerValue(value ?? 10_000))
  @IsInt()
  @Min(1)
  IN_MEMORY_STORE_MAX_ENTRIES = 10_000;

  @Transform(({ value }) => parseIntegerValue(value ?? 60_000))
  @IsInt()
  @Min(1000)
  IN_MEMORY_STORE_SWEEP_INTERVAL_MS = 60_000;

  @Transform(({ value }) => parseIntegerValue(value ?? 1_048_576))
  @IsInt()
  @Min(1024)
  IDEMPOTENCY_MAX_RESPONSE_BYTES = 1_048_576;

  @Transform(({ value }) => parseBooleanValue(value ?? false))
  @IsBoolean()
  CLOUDINARY_ENABLED = false;

  @IsOptional()
  @IsString()
  CLOUDINARY_CLOUD_NAME?: string;

  @IsOptional()
  @IsString()
  CLOUDINARY_API_KEY?: string;

  @IsOptional()
  @IsString()
  CLOUDINARY_API_SECRET?: string;

  @IsString()
  @IsNotEmpty()
  CLOUDINARY_ROOT_FOLDER = 'quan-ly-truyen';

  @IsString()
  @IsNotEmpty()
  CLOUDINARY_SIGNATURE_ALGORITHM = 'sha256';

  @Transform(({ value }) => parseIntegerValue(value ?? 300))
  @IsInt()
  @Min(1)
  CLOUDINARY_UPLOAD_INTENT_TTL_SECONDS = 300;

  @Transform(({ value }) => parseIntegerValue(value ?? 300))
  @IsInt()
  @Min(1)
  CLOUDINARY_WEBHOOK_SIGNATURE_TTL_SECONDS = 300;

  @Transform(({ value }) => parseIntegerValue(value ?? 1000))
  @IsInt()
  @Min(100)
  CLOUDINARY_WEBHOOK_POLL_INTERVAL_MS = 1000;

  @Transform(({ value }) => parseIntegerValue(value ?? 100))
  @IsInt()
  @Min(1)
  @Max(500)
  CLOUDINARY_WEBHOOK_BATCH_SIZE = 100;

  @Transform(({ value }) => parseIntegerValue(value ?? 5))
  @IsInt()
  @Min(1)
  @Max(20)
  CLOUDINARY_WEBHOOK_MAX_ATTEMPTS = 5;

  @Transform(({ value }) => parseIntegerValue(value ?? 5000))
  @IsInt()
  @Min(100)
  CLOUDINARY_WEBHOOK_RETRY_BASE_MS = 5000;

  @Transform(({ value }) => parseIntegerValue(value ?? 5))
  @IsInt()
  @Min(1)
  @Max(20)
  CLOUDINARY_DELETE_MAX_ATTEMPTS = 5;

  @Transform(({ value }) => parseIntegerValue(value ?? 5000))
  @IsInt()
  @Min(100)
  CLOUDINARY_DELETE_RETRY_BASE_MS = 5000;

  @IsOptional()
  @IsString()
  CLOUDINARY_AVATAR_UPLOAD_PRESET?: string;

  @IsOptional()
  @IsString()
  CLOUDINARY_AUTHOR_BANNER_UPLOAD_PRESET?: string;

  @IsOptional()
  @IsString()
  CLOUDINARY_STORY_COVER_UPLOAD_PRESET?: string;

  @IsOptional()
  @IsString()
  CLOUDINARY_CHAPTER_IMAGE_UPLOAD_PRESET?: string;

  @IsOptional()
  @IsString()
  CLOUDINARY_ATTACHMENT_UPLOAD_PRESET?: string;

  @Transform(({ value }) => parseBooleanValue(value ?? false))
  @IsBoolean()
  MAIL_ENABLED = false;

  @IsString()
  @IsNotEmpty()
  MAIL_FROM_NAME = 'Quan Ly Truyen';

  @IsString()
  @IsNotEmpty()
  MAIL_FROM_ADDRESS = 'no-reply@example.com';

  @IsOptional()
  @IsString()
  MAIL_REPLY_TO?: string;

  @IsUrl({ require_tld: false })
  FRONTEND_PUBLIC_URL = 'http://localhost:4200';

  @IsOptional()
  @IsString()
  MAIL_MESSAGE_ID_DOMAIN?: string;

  @IsString()
  SMTP_HOST = 'localhost';

  @Transform(({ value }) => parseIntegerValue(value ?? 1025))
  @IsInt()
  @Min(1)
  @Max(65_535)
  SMTP_PORT = 1025;

  @Transform(({ value }) => parseBooleanValue(value ?? false))
  @IsBoolean()
  SMTP_SECURE = false;

  @Transform(({ value }) => parseBooleanValue(value ?? false))
  @IsBoolean()
  SMTP_REQUIRE_TLS = false;

  @IsOptional()
  @IsString()
  SMTP_USERNAME?: string;

  @IsOptional()
  @IsString()
  SMTP_PASSWORD?: string;

  @Transform(({ value }) => parseBooleanValue(value ?? true))
  @IsBoolean()
  SMTP_POOL_ENABLED = true;

  @Transform(({ value }) => parseIntegerValue(value ?? 3))
  @IsInt()
  @Min(1)
  SMTP_MAX_CONNECTIONS = 3;

  @Transform(({ value }) => parseIntegerValue(value ?? 100))
  @IsInt()
  @Min(1)
  SMTP_MAX_MESSAGES = 100;

  @Transform(({ value }) => parseIntegerValue(value ?? 5))
  @IsInt()
  @Min(1)
  SMTP_RATE_LIMIT_PER_SECOND = 5;

  @Transform(({ value }) => parseIntegerValue(value ?? 60))
  @IsInt()
  @Min(10)
  @Max(3600)
  AUTH_EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS = 60;
  @Transform(({ value }) => parseIntegerValue(value ?? 10_000))
  @IsInt()
  @Min(100)
  SMTP_CONNECTION_TIMEOUT_MS = 10_000;

  @Transform(({ value }) => parseIntegerValue(value ?? 10_000))
  @IsInt()
  @Min(100)
  SMTP_GREETING_TIMEOUT_MS = 10_000;

  @Transform(({ value }) => parseIntegerValue(value ?? 30_000))
  @IsInt()
  @Min(100)
  SMTP_SOCKET_TIMEOUT_MS = 30_000;

  @IsString()
  @IsNotEmpty()
  PRODUCTION_GATE_MIGRATIONS_PATH = 'prisma/migrations';

  @Transform(({ value }) => parseIntegerValue(value ?? 30))
  @IsInt()
  @Min(1)
  @Max(168)
  PRODUCTION_GATE_CLEANUP_MAX_AGE_HOURS = 30;

  @Transform(({ value }) => parseBooleanValue(value ?? true))
  @IsBoolean()
  SMTP_VERIFY_ON_STARTUP = true;

  @Transform(({ value }) => parseBooleanValue(value ?? false))
  @IsBoolean()
  MAIL_DKIM_ENABLED = false;

  @IsOptional()
  @IsString()
  MAIL_PAYLOAD_ENCRYPTION_KEY?: string;

  @Transform(({ value }) => parseBooleanValue(value ?? true))
  @IsBoolean()
  MAIL_PAYLOAD_ALLOW_LEGACY_PLAINTEXT_READ = true;

  @Transform(({ value }) => parseIntegerValue(value ?? 60))
  @IsInt()
  @Min(10)
  @Max(3600)
  AUTH_PASSWORD_RESET_REQUEST_COOLDOWN_SECONDS = 60;
  @IsOptional()
  @IsString()
  MAIL_DKIM_DOMAIN?: string;

  @IsOptional()
  @IsString()
  MAIL_DKIM_SELECTOR?: string;

  @IsOptional()
  @IsString()
  MAIL_DKIM_PRIVATE_KEY_BASE64?: string;
}

export function validateEnvironment(
  rawConfig: Record<string, unknown>,
): Record<string, unknown> {
  const config = plainToInstance(EnvironmentVariables, rawConfig, {
    enableImplicitConversion: false,
    exposeDefaultValues: true,
  });

  const errors = validateSync(config, {
    skipMissingProperties: false,
    whitelist: false,
    forbidUnknownValues: true,
  });

  if (errors.length > 0) {
    const messages = errors.flatMap((error) =>
      Object.values(error.constraints ?? {}).map(
        (message) => `${error.property}: ${message}`,
      ),
    );

    throw new Error(
      `Invalid environment configuration:\n${messages.join('\n')}`,
    );
  }

  validateCrossFieldRules(config);

  return { ...rawConfig, ...config };
}

function validateCrossFieldRules(config: EnvironmentVariables): void {
  const origins = parseCsv(config.CORS_ALLOWED_ORIGINS);

  if (config.JWT_ACCESS_SECRET === config.JWT_REFRESH_SECRET) {
    throw new Error(
      'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different',
    );
  }
  if (
    (config.AUTH_LOGIN_RATE_LIMIT_ENABLED ||
      config.AUTH_JWT_BLACKLIST_ENABLED ||
      config.AUTH_ACCESS_AUTHORIZATION_CACHE_ENABLED) &&
    !config.REDIS_ENABLED
  ) {
    throw new Error(
      [
        'REDIS_ENABLED must be true when login rate limit,',
        'JWT blacklist, or auth authorization cache is enabled',
      ].join(' '),
    );
  }

  if (config.AUTH_COOKIE_SAME_SITE === 'none' && !config.AUTH_COOKIE_SECURE) {
    throw new Error(
      'AUTH_COOKIE_SECURE must be true when AUTH_COOKIE_SAME_SITE=none',
    );
  }

  if (
    config.NODE_ENV === AppEnvironment.PRODUCTION &&
    !config.AUTH_COOKIE_SECURE
  ) {
    throw new Error('AUTH_COOKIE_SECURE must be true in production');
  }
  if (
    config.NODE_ENV === AppEnvironment.PRODUCTION &&
    !config.AUTH_CSRF_ENABLED
  ) {
    throw new Error('AUTH_CSRF_ENABLED must be true in production');
  }

  if (config.AUTH_CSRF_ENABLED && !config.AUTH_CSRF_SECRET?.trim()) {
    throw new Error('AUTH_CSRF_SECRET is required when AUTH_CSRF_ENABLED=true');
  }

  if (
    config.AUTH_CSRF_SECRET &&
    (config.AUTH_CSRF_SECRET === config.JWT_ACCESS_SECRET ||
      config.AUTH_CSRF_SECRET === config.JWT_REFRESH_SECRET)
  ) {
    throw new Error(
      'AUTH_CSRF_SECRET must be different from JWT_ACCESS_SECRET and JWT_REFRESH_SECRET',
    );
  }

  if (config.AUTH_CSRF_COOKIE_NAME === config.AUTH_REFRESH_COOKIE_NAME) {
    throw new Error(
      'AUTH_CSRF_COOKIE_NAME must be different from AUTH_REFRESH_COOKIE_NAME',
    );
  }

  if (config.AUTH_CSRF_COOKIE_PATH !== '/') {
    throw new Error('AUTH_CSRF_COOKIE_PATH must be exactly "/"');
  }
  if (config.CORS_CREDENTIALS && origins.includes('*')) {
    throw new Error(
      'CORS_ALLOWED_ORIGINS cannot contain "*" when CORS_CREDENTIALS=true',
    );
  }
  if (
    config.QUEUE_ENABLED &&
    config.QUEUE_WORKER_HEARTBEAT_ENABLED &&
    config.QUEUE_WORKER_HEARTBEAT_TTL_SECONDS * 1000 <
      config.QUEUE_WORKER_HEARTBEAT_INTERVAL_MS * 2
  ) {
    throw new Error(
      'QUEUE_WORKER_HEARTBEAT_TTL_SECONDS must be at least twice QUEUE_WORKER_HEARTBEAT_INTERVAL_MS',
    );
  }

  const supportedLocales = parseCsv(config.SUPPORTED_LOCALES);

  if (!supportedLocales.includes(config.DEFAULT_LOCALE)) {
    throw new Error('DEFAULT_LOCALE must be included in SUPPORTED_LOCALES');
  }
  if (
    (config.AUTH_LOGIN_RATE_LIMIT_ENABLED ||
      config.AUTH_JWT_BLACKLIST_ENABLED) &&
    !config.REDIS_ENABLED
  ) {
    throw new Error(
      'REDIS_ENABLED must be true when login rate limit or JWT blacklist is enabled',
    );
  }

  if (
    config.NODE_ENV === AppEnvironment.PRODUCTION &&
    !config.AUTH_JWT_BLACKLIST_ENABLED
  ) {
    throw new Error('AUTH_JWT_BLACKLIST_ENABLED must be true in production');
  }

  if (
    config.NODE_ENV === AppEnvironment.PRODUCTION &&
    config.AUTH_JWT_BLACKLIST_FAILURE_MODE !== 'closed'
  ) {
    throw new Error(
      'AUTH_JWT_BLACKLIST_FAILURE_MODE must be closed in production',
    );
  }
  if (
    config.MAIL_QUEUE_FAILED_RETENTION_SECONDS <
    config.MAIL_QUEUE_COMPLETED_RETENTION_SECONDS
  ) {
    throw new Error(
      'MAIL_QUEUE_FAILED_RETENTION_SECONDS must be greater than or equal to MAIL_QUEUE_COMPLETED_RETENTION_SECONDS',
    );
  }

  if (config.NODE_ENV === AppEnvironment.PRODUCTION && config.SWAGGER_ENABLED) {
    throw new Error(
      'SWAGGER_ENABLED must be false in production unless explicitly reviewed',
    );
  }

  if (config.METRICS_PATH !== '/internal/metrics') {
    throw new Error('METRICS_PATH must be exactly /internal/metrics');
  }

  let redisUrl: URL;
  try {
    redisUrl = new URL(config.REDIS_URL);
  } catch {
    throw new Error('REDIS_URL must be a valid redis:// or rediss:// URL');
  }
  if (!['redis:', 'rediss:'].includes(redisUrl.protocol)) {
    throw new Error('REDIS_URL protocol must be redis:// or rediss://');
  }
  if (config.NODE_ENV === AppEnvironment.PRODUCTION && !config.QUEUE_ENABLED) {
    throw new Error(
      'QUEUE_ENABLED must be true in production because transactional outbox delivery is required',
    );
  }

  if (config.QUEUE_ENABLED && !config.REDIS_ENABLED) {
    throw new Error('REDIS_ENABLED must be true when QUEUE_ENABLED=true');
  }

  if (config.NODE_ENV === AppEnvironment.PRODUCTION && !config.REDIS_ENABLED) {
    throw new Error(
      'REDIS_ENABLED must be true in production because idempotency and distributed locks fail closed',
    );
  }

  if (
    config.NODE_ENV === AppEnvironment.PRODUCTION &&
    config.ALLOW_IN_MEMORY_INFRASTRUCTURE_FALLBACK
  ) {
    throw new Error(
      'ALLOW_IN_MEMORY_INFRASTRUCTURE_FALLBACK must be false in production',
    );
  }

  if (
    config.NODE_ENV === AppEnvironment.PRODUCTION &&
    config.METRICS_ENABLED &&
    (!config.METRICS_BEARER_TOKEN ||
      config.METRICS_BEARER_TOKEN.trim().length < 32)
  ) {
    throw new Error(
      'METRICS_BEARER_TOKEN must contain at least 32 characters when metrics are enabled in production',
    );
  }

  if (config.CLOUDINARY_ENABLED) {
    const requiredVars: (keyof EnvironmentVariables)[] = [
      'CLOUDINARY_CLOUD_NAME',
      'CLOUDINARY_API_KEY',
      'CLOUDINARY_API_SECRET',
      'CLOUDINARY_AVATAR_UPLOAD_PRESET',
      'CLOUDINARY_AUTHOR_BANNER_UPLOAD_PRESET',
      'CLOUDINARY_STORY_COVER_UPLOAD_PRESET',
      'CLOUDINARY_CHAPTER_IMAGE_UPLOAD_PRESET',
      'CLOUDINARY_ATTACHMENT_UPLOAD_PRESET',
    ];

    for (const key of requiredVars) {
      if (!config[key]) {
        throw new Error(`${key} is required when CLOUDINARY_ENABLED=true`);
      }
    }

    if (
      !['sha256', 'sha1'].includes(
        config.CLOUDINARY_SIGNATURE_ALGORITHM.toLowerCase(),
      )
    ) {
      throw new Error(
        'CLOUDINARY_SIGNATURE_ALGORITHM must be either "sha256" or "sha1"',
      );
    }
  }
  if (config.NODE_ENV === AppEnvironment.PRODUCTION && !config.REDIS_ENABLED) {
    throw new Error(
      'REDIS_ENABLED must be true in production for email verification resend cooldown',
    );
  }
  validateProductionGateRules(config);

  validateMailRules(config);
  validateMailPayloadEncryptionRules(config);
}

function validateProductionGateRules(config: EnvironmentVariables): void {
  if (config.NODE_ENV !== AppEnvironment.PRODUCTION) {
    return;
  }

  if (!config.OBSERVABILITY_ENABLED) {
    throw new Error('OBSERVABILITY_ENABLED must be true in production');
  }

  if (!config.METRICS_ENABLED) {
    throw new Error('METRICS_ENABLED must be true in production');
  }

  if (!config.REDIS_ENABLED) {
    throw new Error('REDIS_ENABLED must be true in production');
  }

  if (!config.QUEUE_ENABLED) {
    throw new Error('QUEUE_ENABLED must be true in production');
  }

  if (!config.QUEUE_WORKER_HEARTBEAT_ENABLED) {
    throw new Error(
      'QUEUE_WORKER_HEARTBEAT_ENABLED must be true in production',
    );
  }

  if (config.IDEMPOTENCY_FAILURE_MODE !== 'closed') {
    throw new Error('IDEMPOTENCY_FAILURE_MODE must be closed in production');
  }

  if (config.ALLOW_IN_MEMORY_INFRASTRUCTURE_FALLBACK) {
    throw new Error(
      'ALLOW_IN_MEMORY_INFRASTRUCTURE_FALLBACK must be false in production',
    );
  }

  if (!config.MAIL_ENABLED) {
    throw new Error(
      'MAIL_ENABLED must be true in production because Auth requires verification and password-reset email',
    );
  }

  if (!config.SMTP_VERIFY_ON_STARTUP) {
    throw new Error('SMTP_VERIFY_ON_STARTUP must be true in production');
  }

  /*
   * Sau khi legacy queue đã drain xong,
   * production không được đọc plaintext mail job.
   */
  if (config.MAIL_PAYLOAD_ALLOW_LEGACY_PLAINTEXT_READ) {
    throw new Error(
      'MAIL_PAYLOAD_ALLOW_LEGACY_PLAINTEXT_READ must be false in production',
    );
  }

  if (config.AUTH_JWT_BLACKLIST_ENABLED !== true) {
    throw new Error('AUTH_JWT_BLACKLIST_ENABLED must be true in production');
  }

  if (config.AUTH_JWT_BLACKLIST_FAILURE_MODE !== 'closed') {
    throw new Error(
      'AUTH_JWT_BLACKLIST_FAILURE_MODE must be closed in production',
    );
  }

  if (config.AUTH_LOGIN_RATE_LIMIT_ENABLED !== true) {
    throw new Error('AUTH_LOGIN_RATE_LIMIT_ENABLED must be true in production');
  }

  if (config.AUTH_CSRF_ENABLED !== true) {
    throw new Error('AUTH_CSRF_ENABLED must be true in production');
  }

  if (!config.AUTH_COOKIE_SECURE) {
    throw new Error('AUTH_COOKIE_SECURE must be true in production');
  }

  if (config.AUTH_COOKIE_PATH !== '/api/v1/auth') {
    throw new Error(
      'AUTH_COOKIE_PATH must be exactly /api/v1/auth in production',
    );
  }

  if (config.AUTH_CSRF_COOKIE_PATH !== '/') {
    throw new Error('AUTH_CSRF_COOKIE_PATH must be exactly / in production');
  }

  if (config.SWAGGER_ENABLED) {
    throw new Error('SWAGGER_ENABLED must be false in production');
  }

  assertHttpsUrl(
    'APP_PUBLIC_URL',

    config.APP_PUBLIC_URL,
  );

  assertHttpsUrl(
    'FRONTEND_PUBLIC_URL',

    config.FRONTEND_PUBLIC_URL,
  );

  const origins = parseCsv(config.CORS_ALLOWED_ORIGINS);

  for (const origin of origins) {
    assertHttpsUrl(
      'CORS_ALLOWED_ORIGINS',

      origin,
    );

    const url = new URL(origin);

    if (isLoopbackHostname(url.hostname)) {
      throw new Error(
        'CORS_ALLOWED_ORIGINS cannot contain localhost or loopback addresses in production',
      );
    }
  }

  assertProductionSecret(
    'JWT_ACCESS_SECRET',

    config.JWT_ACCESS_SECRET,
  );

  assertProductionSecret(
    'JWT_REFRESH_SECRET',

    config.JWT_REFRESH_SECRET,
  );

  assertProductionSecret(
    'AUTH_CSRF_SECRET',

    config.AUTH_CSRF_SECRET,
  );

  if (
    config.JWT_ACCESS_SECRET === config.AUTH_CSRF_SECRET ||
    config.JWT_REFRESH_SECRET === config.AUTH_CSRF_SECRET
  ) {
    throw new Error('AUTH_CSRF_SECRET must be different from both JWT secrets');
  }

  if (!config.PRODUCTION_GATE_MIGRATIONS_PATH.trim()) {
    throw new Error('PRODUCTION_GATE_MIGRATIONS_PATH cannot be empty');
  }
}

function assertHttpsUrl(
  name: string,

  value: string,
): void {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }

  if (url.protocol !== 'https:') {
    throw new Error(`${name} must use https:// in production`);
  }
}

function assertProductionSecret(
  name: string,

  value: string | undefined,
): void {
  const normalized = value?.trim();

  if (!normalized || normalized.length < 32) {
    throw new Error(
      `${name} must contain at least 32 characters in production`,
    );
  }

  const knownPlaceholder =
    /^(?:change-?me|replace-?me|your[_-]|example|development|local|test[_-]?secret)/iu;

  if (knownPlaceholder.test(normalized)) {
    throw new Error(
      `${name} cannot use a known placeholder value in production`,
    );
  }
}

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();

  return ['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(normalized);
}

function validateMailRules(config: EnvironmentVariables): void {
  if (!config.MAIL_ENABLED) return;

  if (
    !config.MAIL_MESSAGE_ID_DOMAIN ||
    !isValidMessageIdDomain(config.MAIL_MESSAGE_ID_DOMAIN)
  ) {
    throw new Error(
      'MAIL_MESSAGE_ID_DOMAIN must be a valid DNS domain when MAIL_ENABLED=true',
    );
  }

  if (!config.SMTP_HOST.trim()) {
    throw new Error('SMTP_HOST is required when MAIL_ENABLED=true');
  }
  if (Boolean(config.SMTP_USERNAME) !== Boolean(config.SMTP_PASSWORD)) {
    throw new Error(
      'SMTP_USERNAME and SMTP_PASSWORD must be provided together',
    );
  }
  if (config.SMTP_PORT === 465 && !config.SMTP_SECURE) {
    throw new Error('SMTP_SECURE should be true when SMTP_PORT=465');
  }
  if (
    config.MAIL_DKIM_ENABLED &&
    (!config.MAIL_DKIM_DOMAIN ||
      !config.MAIL_DKIM_SELECTOR ||
      !config.MAIL_DKIM_PRIVATE_KEY_BASE64)
  ) {
    throw new Error(
      'DKIM domain, selector and private key are required when MAIL_DKIM_ENABLED=true',
    );
  }
}

function validateMailPayloadEncryptionRules(
  config: EnvironmentVariables,
): void {
  const key = config.MAIL_PAYLOAD_ENCRYPTION_KEY?.trim();

  const requiredInProduction =
    config.NODE_ENV === AppEnvironment.PRODUCTION &&
    (config.MAIL_ENABLED || config.QUEUE_ENABLED);

  if (requiredInProduction && !key) {
    throw new Error(
      'MAIL_PAYLOAD_ENCRYPTION_KEY is required in production when mail or queue is enabled',
    );
  }

  if (key && !isValidBase64Key(key, 32)) {
    throw new Error(
      'MAIL_PAYLOAD_ENCRYPTION_KEY must be Base64 encoding of exactly 32 bytes',
    );
  }
}

function isValidBase64Key(value: string, expectedBytes: number): boolean {
  const normalized = value.trim();

  if (
    !normalized ||
    normalized.length % 4 === 1 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)
  ) {
    return false;
  }

  const decoded = Buffer.from(normalized, 'base64');

  const canonical = decoded.toString('base64').replace(/=+$/u, '');

  const input = normalized.replace(/=+$/u, '');

  return decoded.length === expectedBytes && canonical === input;
}

function isValidMessageIdDomain(value: string): boolean {
  return /^(?=.{1,253}$)(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/.test(
    value,
  );
}

export function parseCsv(value: string): string[] {
  return [
    ...new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}
