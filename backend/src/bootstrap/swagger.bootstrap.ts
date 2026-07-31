import type { INestApplication } from '@nestjs/common';
import {
    DocumentBuilder,
    SwaggerModule,
} from '@nestjs/swagger';

import {
    API_PREFIX,
    APP_NAME,
} from '@/common/constants';

export function configureSwagger(
    app: INestApplication,
): void {
    if (process.env.SWAGGER_ENABLED !== 'true') {
        return;
    }

    const config = new DocumentBuilder()
        .setTitle(APP_NAME)
        .setDescription('API quản lý và đọc truyện')
        .setVersion('1.0')
        .addBearerAuth(
            {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
            },
            'access-token',
        )
        .addTag('Auth')
        .addTag('Users')
        .addTag('Authors')
        .addTag('Stories')
        .addTag('Chapters')
        .addTag('Admin')
        .addTag('Health')
        .build();

    const document = SwaggerModule.createDocument(app, config);

    SwaggerModule.setup(`${API_PREFIX}/docs`, app, document, {
        swaggerOptions: {
            persistAuthorization: true,
            displayRequestDuration: true,
            filter: true,
        },
    });
}