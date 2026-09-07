import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HealthCheck,
  HealthCheckResult,
  HealthCheckService,
} from '@nestjs/terminus';

import {
  Public,
  RequirePermissions,
  SkipRequestLogging,
  SkipResponseEnvelope,
} from '@/common/decorators';
import { PermissionCode } from '@/common/enums';
import type { AppConfig } from '@/config';

import { DatabaseHealthIndicator } from './database-health.indicator';
import { QueueWorkerHealthIndicator } from './queue-worker-health.indicator';
import { RedisHealthIndicator } from './redis-health.indicator';
import {
  InfrastructureDiagnostics,
  InfrastructureDiagnosticsService,
} from './infrastructure-diagnostics.service';

@Controller('health')
@SkipResponseEnvelope()
@SkipRequestLogging()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly database: DatabaseHealthIndicator,
    private readonly redis: RedisHealthIndicator,
    private readonly queueWorker: QueueWorkerHealthIndicator,
    private readonly diagnosticsService: InfrastructureDiagnosticsService,
    private readonly configService: ConfigService,
  ) {}

  @Get('live')
  @Public()
  live(): { status: 'ok'; releaseSha: string } {
    const app = this.configService.getOrThrow<AppConfig>('app');

    return { status: 'ok', releaseSha: app.releaseSha };
  }

  @Get('ready')
  @Public()
  @HealthCheck()
  async ready(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.database.isHealthy(),
      () => this.redis.isHealthy(),
      () => this.queueWorker.isHealthy(),
    ]);
  }

  @Get('diagnostics')
  @RequirePermissions(PermissionCode.AUDIT_LOG_READ)
  diagnostics(): Promise<InfrastructureDiagnostics> {
    return this.diagnosticsService.inspect();
  }
}
