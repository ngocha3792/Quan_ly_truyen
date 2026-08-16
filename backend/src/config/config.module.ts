import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import productionGateConfig from './production-gate.config';
import analyticsConfig from './analytics.config';
import appConfig from './app.config';
import authConfig from './auth.config';
import cloudinaryConfig from './cloudinary.config';
import corsConfig from './cors.config';
import databaseConfig from './database.config';
import { validateEnvironment } from './environment.validation';
import maintenanceConfig from './maintenance.config';
import mailConfig from './mail.config';
import idempotencyConfig from './idempotency.config';
import infrastructureFallbackConfig from './infrastructure-fallback.config';
import queueConfig from './queue.config';
import redisConfig from './redis.config';
import { resolveEnvFilePaths } from './environment-files';
import observabilityConfig from './observability.config';

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: false,
      envFilePath: resolveEnvFilePaths(),
      ignoreEnvFile: process.env.NODE_ENV === 'production',
      load: [
        appConfig,
        authConfig,
        cloudinaryConfig,
        databaseConfig,
        corsConfig,
        maintenanceConfig,
        mailConfig,
        idempotencyConfig,
        infrastructureFallbackConfig,
        redisConfig,
        queueConfig,
        observabilityConfig,
        productionGateConfig,
        analyticsConfig,
      ],
      validate: validateEnvironment,
    }),
  ],
  exports: [NestConfigModule],
})
export class AppConfigModule {}
