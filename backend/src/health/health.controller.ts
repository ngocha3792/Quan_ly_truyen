import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckResult,
  HealthCheckService,
} from '@nestjs/terminus';

import {
  Public,
  RequirePermissions,
  SkipResponseEnvelope,
  SkipRequestLogging,
} from '@/common/decorators';
import { PermissionCode } from '@/common/enums';
import {
  DatabaseHealthIndicator,
  RedisHealthIndicator,
} from '@/infrastructure/health';
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
    ]);
  }

  @Get('diagnostics')
  @RequirePermissions(PermissionCode.AUDIT_LOG_READ)
  diagnostics(): Promise<InfrastructureDiagnostics> {
    return this.diagnosticsService.inspect();
  }
}
