import { Module } from '@nestjs/common';
import { PrismaModule } from '@/infrastructure/database';
import { AuditLogsService } from './application';
import { PrismaAuditLogRepository } from './infrastructure';
import { AdminAuditLogsController } from './presentation/http/admin-audit-logs.controller';

@Module({
  imports: [PrismaModule],
  controllers: [AdminAuditLogsController],
  providers: [AuditLogsService, PrismaAuditLogRepository],
})
export class AuditLogsModule {}
