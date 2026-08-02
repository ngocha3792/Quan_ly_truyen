import { Controller, Get } from '@nestjs/common';
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
  ) {}

  @Get('live')
  @Public()
  live(): { status: 'ok' } {
    return { status: 'ok' };
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
