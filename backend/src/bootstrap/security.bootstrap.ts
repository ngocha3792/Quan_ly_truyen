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
                // Swagger UI sử dụng inline script/style.
                contentSecurityPolicy: false,

                // API trả JSON/media URL, không cần bật COEP toàn cục.
                crossOriginEmbedderPolicy: false,
            })
            : helmet({
                crossOriginEmbedderPolicy: false,
            }),
    );
}