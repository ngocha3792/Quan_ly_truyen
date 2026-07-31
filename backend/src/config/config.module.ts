import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

import appConfig from './app.config';
import corsConfig from './cors.config';
import databaseConfig from './database.config';
import { validateEnvironment } from './environment.validation';
import maintenanceConfig from './maintenance.config';

function resolveEnvFilePaths(): string[] {
  const environment = process.env.NODE_ENV ?? 'development';

  return [
    `.env.${environment}.local`,
    `.env.${environment}`,
    '.env.local',
    '.env',
  ];
}

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: false,
      envFilePath: resolveEnvFilePaths(),
      ignoreEnvFile: process.env.NODE_ENV === 'production',
      load: [appConfig, databaseConfig, corsConfig, maintenanceConfig],
      validate: validateEnvironment,
    }),
  ],
})
export class AppConfigModule {}
