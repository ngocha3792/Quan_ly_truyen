import type { INestApplication } from '@nestjs/common';

function parseAllowedOrigins(): string[] {
    const value = process.env.CORS_ALLOWED_ORIGINS;

    if (!value) {
        return ['http://localhost:4200'];
    }

    return value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
}

export function configureCors(app: INestApplication): void {
    const allowedOrigins = parseAllowedOrigins();

    app.enableCors({
        origin: allowedOrigins,
        credentials: true,
        methods: [
            'GET',
            'HEAD',
            'POST',
            'PUT',
            'PATCH',
            'DELETE',
            'OPTIONS',
        ],
        allowedHeaders: [
            'authorization',
            'content-type',
            'accept-language',
            'x-request-id',
            'x-correlation-id',
            'idempotency-key',
        ],
        exposedHeaders: [
            'x-request-id',
            'x-correlation-id',
            'content-language',
            'retry-after',
        ],
        maxAge: 86_400,
    });
}