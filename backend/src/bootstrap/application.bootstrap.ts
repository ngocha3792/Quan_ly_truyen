import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from '@/app.module';
import type { AppConfig, CorsConfig } from '@/config';
import { AppLoggerService } from '@/infrastructure/observability';

import { configureApplication } from './application-configurator';
import { configureCors } from './cors.bootstrap';
import { configureSecurityHeaders } from './security.bootstrap';
import { configureShutdown } from './shutdown.bootstrap';
import { configureSwagger } from './swagger.bootstrap';

const bootstrapLogger = new Logger('Bootstrap');

export async function bootstrapApplication(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });

  app.useLogger(app.get(AppLoggerService));
  app.flushLogs();

  const configService = app.get(ConfigService);
  const appConfig = configService.getOrThrow<AppConfig>('app');
  const corsConfig = configService.getOrThrow<CorsConfig>('cors');

  configureApplication(app, appConfig);
  configureSecurityHeaders(app, appConfig);
  configureCors(app, corsConfig);
  configureShutdown(app);
  configureSwagger(app, appConfig);

  await app.listen(appConfig.port, appConfig.host);

  const applicationUrl = await app.getUrl();

  bootstrapLogger.log({
    event: 'application.started',
    address: applicationUrl,
    environment: appConfig.environment,
  });
}

export async function runApplication(): Promise<void> {
  await bootstrapApplication();
}
