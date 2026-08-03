import type { INestApplication } from '@nestjs/common';

import { CSRF_HEADER_NAME } from '@/common/constants';

import type { CorsConfig } from '@/config';

export function configureCors(
  app: INestApplication,

  config: CorsConfig,
): void {
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

      CSRF_HEADER_NAME,

      // Giữ lại để tương thích client cũ.
      'idempotency-key',

      'x-idempotency-key',
    ],

    exposedHeaders: [
      'x-request-id',
      'x-correlation-id',
      'content-language',
      'retry-after',

      /*
       * Login/refresh trả CSRF token mới
       * qua response header này.
       */
      CSRF_HEADER_NAME,
    ],
  });
}
