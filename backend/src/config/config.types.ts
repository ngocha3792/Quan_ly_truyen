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
}
