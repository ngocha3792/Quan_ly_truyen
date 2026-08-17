import { Module } from '@nestjs/common';

import { PrismaModule } from '@/infrastructure/database';
import { AuthAuthorizationModule } from '@/modules/auth';

import {
  REPORT_REPOSITORY,
  GetReportQueryHandler,
  ListReportsQueryHandler,
  RejectReportCommandHandler,
  ResolveReportCommandHandler,
} from './application';
import { PrismaReportRepository } from './infrastructure';
import { AdminReportsController } from './presentation/http/controllers';

@Module({
  imports: [PrismaModule, AuthAuthorizationModule],
  controllers: [AdminReportsController],
  providers: [
    ListReportsQueryHandler,
    GetReportQueryHandler,
    ResolveReportCommandHandler,
    RejectReportCommandHandler,
    PrismaReportRepository,
    { provide: REPORT_REPOSITORY, useExisting: PrismaReportRepository },
  ],
})
export class ReportsModule {}
