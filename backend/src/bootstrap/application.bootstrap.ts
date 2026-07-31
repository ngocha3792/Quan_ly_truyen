import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from '@/app.module';

import { configureApplication } from './application-configurator';
import { configureCors } from './cors.bootstrap';
import { configureShutdown } from './shutdown.bootstrap';
import { configureSwagger } from './swagger.bootstrap';

const bootstrapLogger = new Logger('Bootstrap');

export async function bootstrapApplication(): Promise<void> {
    const app = await NestFactory.create(AppModule, {
        bufferLogs: true,
    });

    configureApplication(app);
    configureCors(app);
    configureShutdown(app);
    configureSwagger(app);

    const port = Number(process.env.PORT ?? 3000);
    const host = process.env.HOST ?? '0.0.0.0';

    await app.listen(port, host);

    const applicationUrl = await app.getUrl();

    bootstrapLogger.log(`Application started at ${applicationUrl}`);
    bootstrapLogger.log(`Environment: ${process.env.NODE_ENV ?? 'development'}`);
}

export async function runApplication(): Promise<void> {
    try {
        await bootstrapApplication();
    } catch (error: unknown) {
        bootstrapLogger.error(
            'Application bootstrap failed',
            error instanceof Error ? error.stack : String(error),
        );

        process.exitCode = 1;
    }
}