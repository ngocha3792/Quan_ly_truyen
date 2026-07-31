import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';

import {
    API_PREFIX,
    CONTENT_TYPES,
} from '@/common/constants';
import { AppValidationPipe } from '@/common/pipes';

export function configureApplication(
    app: INestApplication,
): void {
    app.setGlobalPrefix(API_PREFIX);

    app.useGlobalPipes(new AppValidationPipe());

    const expressApp = app as NestExpressApplication;

    expressApp.use(
        json({
            limit: process.env.JSON_BODY_LIMIT ?? '2mb',
            type: CONTENT_TYPES.JSON,
        }),
    );

    expressApp.use(
        urlencoded({
            extended: true,
            limit: process.env.URL_ENCODED_BODY_LIMIT ?? '2mb',
        }),
    );

    const trustProxy = process.env.TRUST_PROXY;

    if (trustProxy === 'true') {
        expressApp.set('trust proxy', true);
    }
}