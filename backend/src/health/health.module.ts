import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

import { RedisModule } from '@/infrastructure/cache/redis/redis.module';
import { PrismaModule } from '@/infrastructure/database';
import {
  DatabaseHealthIndicator,
  QueueWorkerHealthIndicator,
  RedisHealthIndicator,
} from '@/infrastructure/health';
import { MailTransportModule } from '@/infrastructure/mail';

import { HealthController } from './health.controller';
import { InfrastructureDiagnosticsService } from './infrastructure-diagnostics.service';

@Module({
  imports: [
    TerminusModule,
    PrismaModule,
    RedisModule,
    MailTransportModule,
  ],
  controllers: [HealthController],
  providers: [
    DatabaseHealthIndicator,
    RedisHealthIndicator,
    QueueWorkerHealthIndicator,
    InfrastructureDiagnosticsService,
  ],
})
export class HealthModule { }