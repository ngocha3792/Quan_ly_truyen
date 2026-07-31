import { registerAs } from '@nestjs/config';

import type { CorsConfig } from './config.types';
import { parseCsv } from './environment.validation';

export const CORS_CONFIG_KEY = 'cors';

export default registerAs(CORS_CONFIG_KEY, (): CorsConfig => ({
  allowedOrigins: parseCsv(
    process.env.CORS_ALLOWED_ORIGINS ?? 'http://localhost:4200',
  ),
  credentials: process.env.CORS_CREDENTIALS !== 'false',
  maxAgeSeconds: Number(process.env.CORS_MAX_AGE_SECONDS ?? 86_400),
}));
