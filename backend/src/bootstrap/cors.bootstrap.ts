import type { INestApplication } from '@nestjs/common';

import type { CorsConfig } from '@/config';

export function configureCors(app: INestApplication, config: CorsConfig): void {
  app.enableCors({
    origin: [...config.allowedOrigins],
    credentials: config.credentials,
    maxAge: config.maxAgeSeconds,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'authorization',
      'content-type',
      'accept-language',
      'x-request-id',
      'x-correlation-id',
      'x-trace-id',
      'idempotency-key',
    ],
    exposedHeaders: [
      'x-request-id',
      'x-correlation-id',
      'content-language',
      'retry-after',
    ],
  });
}
