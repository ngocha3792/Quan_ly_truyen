import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
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

  if (config.CORS_CREDENTIALS && origins.includes('*')) {
    throw new Error(
      'CORS_ALLOWED_ORIGINS cannot contain "*" when CORS_CREDENTIALS=true',
    );
  }

  const supportedLocales = parseCsv(config.SUPPORTED_LOCALES);

  if (!supportedLocales.includes(config.DEFAULT_LOCALE)) {
    throw new Error('DEFAULT_LOCALE must be included in SUPPORTED_LOCALES');
  }

  if (config.NODE_ENV === AppEnvironment.PRODUCTION && config.SWAGGER_ENABLED) {
    throw new Error(
      'SWAGGER_ENABLED must be false in production unless explicitly reviewed',
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
