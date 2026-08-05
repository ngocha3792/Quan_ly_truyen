import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';

import type { AppConfig } from '@/config';

export function configureSecurityHeaders(
  app: INestApplication,
  config: AppConfig,
): void {
  const expressApp = app as NestExpressApplication;

  expressApp.disable('x-powered-by');

  expressApp.use(
    config.swaggerEnabled
      ? helmet({
          // Swagger UI sử dụng inline script/style nên cần CSP tùy chỉnh thay vì tắt hẳn.
          contentSecurityPolicy: {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'", "'unsafe-inline'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:', 'blob:'],
              fontSrc: ["'self'", 'data:'],
              connectSrc: ["'self'"],
              objectSrc: ["'none'"],
              frameAncestors: ["'self'"],
            },
          },

          // API trả JSON/media URL, không cần bật COEP toàn cục.
          crossOriginEmbedderPolicy: false,
        })
      : helmet({
          crossOriginEmbedderPolicy: false,
        }),
  );
}
