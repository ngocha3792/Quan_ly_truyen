import type { INestApplication } from '@nestjs/common';

export function configureShutdown(
    app: INestApplication,
): void {
    app.enableShutdownHooks([
        'SIGINT',
        'SIGTERM',
    ]);
}