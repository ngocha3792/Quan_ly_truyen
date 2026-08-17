import { Module } from '@nestjs/common';
import { PrismaModule } from '@/infrastructure/database';
import { ObservabilityModule } from '@/infrastructure/observability';
import {
  AUDIT_LOG_METRICS_PORT,
  AUDIT_LOG_REPOSITORY_PORT,
  AuditLogsService,
} from './application';
import {
  MetricsAuditLogAdapter,
  PrismaAuditLogRepository,
} from './infrastructure';
import { AdminAuditLogsController } from './presentation/http/admin-audit-logs.controller';

@Module({
  imports: [PrismaModule, ObservabilityModule],
  controllers: [AdminAuditLogsController],
  providers: [
    AuditLogsService,
    PrismaAuditLogRepository,
    MetricsAuditLogAdapter,
    { provide: AUDIT_LOG_REPOSITORY_PORT, useExisting: PrismaAuditLogRepository },
    { provide: AUDIT_LOG_METRICS_PORT, useExisting: MetricsAuditLogAdapter },
  ],
})
export class AuditLogsModule {}
