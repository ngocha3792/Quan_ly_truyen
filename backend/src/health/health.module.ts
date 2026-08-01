import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

import { RedisModule } from '@/infrastructure/cache/redis/redis.module';
import { PrismaModule } from '@/infrastructure/database';
import { MailTransportModule } from '@/infrastructure/mail';
import {
  DatabaseHealthIndicator,
  RedisHealthIndicator,
} from '@/infrastructure/health';

import { HealthController } from './health.controller';
import { InfrastructureDiagnosticsService } from './infrastructure-diagnostics.service';

@Module({
  imports: [TerminusModule, PrismaModule, RedisModule, MailTransportModule],
  controllers: [HealthController],
  providers: [
    DatabaseHealthIndicator,
    RedisHealthIndicator,
    InfrastructureDiagnosticsService,
  ],
})
export class HealthModule {}
