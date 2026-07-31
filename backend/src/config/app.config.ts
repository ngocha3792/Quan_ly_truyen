import { registerAs } from '@nestjs/config';

import { AppEnvironment } from '@/common/enums';

import type { AppConfig } from './config.types';
import { parseCsv } from './environment.validation';

export const APP_CONFIG_KEY = 'app';

export default registerAs(APP_CONFIG_KEY, (): AppConfig => ({
  environment:
    (process.env.NODE_ENV as AppEnvironment | undefined) ??
    AppEnvironment.DEVELOPMENT,
  host: process.env.HOST ?? '0.0.0.0',
  port: Number(process.env.PORT ?? 3000),
  publicUrl: process.env.APP_PUBLIC_URL ?? 'http://localhost:3000',
  trustProxy: process.env.TRUST_PROXY === 'true',
  requestTimeoutMs: Number(process.env.HTTP_REQUEST_TIMEOUT_MS ?? 15_000),
  jsonBodyLimit: process.env.JSON_BODY_LIMIT ?? '2mb',
  urlEncodedBodyLimit: process.env.URL_ENCODED_BODY_LIMIT ?? '2mb',
  swaggerEnabled: process.env.SWAGGER_ENABLED === 'true',
  defaultLocale: process.env.DEFAULT_LOCALE ?? 'vi-VN',
  supportedLocales: parseCsv(process.env.SUPPORTED_LOCALES ?? 'vi-VN,en-US'),
}));
