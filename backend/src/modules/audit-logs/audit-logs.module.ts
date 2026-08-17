import { Module } from '@nestjs/common';

import { PrismaModule } from '@/infrastructure/database';
import { ObservabilityModule } from '@/infrastructure/observability';

import {
  AUDIT_LOG_METRICS_PORT,
  AUDIT_LOG_REPOSITORY_PORT,
  GetAuditLogDetailQueryHandler,
  ListAuditLogsQueryHandler,
} from './application';
import {
  MetricsAuditLogAdapter,
  PrismaAuditLogRepository,
} from './infrastructure';
import { AdminAuditLogsController } from './presentation/http/controllers';

@Module({
  imports: [PrismaModule, ObservabilityModule],
  controllers: [AdminAuditLogsController],
  providers: [
    GetAuditLogDetailQueryHandler,
    ListAuditLogsQueryHandler,
    PrismaAuditLogRepository,
    MetricsAuditLogAdapter,
    {
      provide: AUDIT_LOG_REPOSITORY_PORT,
      useExisting: PrismaAuditLogRepository,
    },
    { provide: AUDIT_LOG_METRICS_PORT, useExisting: MetricsAuditLogAdapter },
  ],
})
export class AuditLogsModule {}
