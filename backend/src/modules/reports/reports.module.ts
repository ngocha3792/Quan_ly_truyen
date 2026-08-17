import { Module } from '@nestjs/common';
import { PrismaModule } from '@/infrastructure/database';
import { AuthAuthorizationModule } from '@/modules/auth';
import { REPORT_REPOSITORY, ReportsService } from './application';
import { PrismaReportRepository } from './infrastructure';
import { AdminReportsController } from './presentation/http/controllers';

@Module({
  imports: [PrismaModule, AuthAuthorizationModule],
  controllers: [AdminReportsController],
  providers: [
    ReportsService,
    PrismaReportRepository,
    { provide: REPORT_REPOSITORY, useExisting: PrismaReportRepository },
  ],
  exports: [ReportsService],
})
export class ReportsModule {}
