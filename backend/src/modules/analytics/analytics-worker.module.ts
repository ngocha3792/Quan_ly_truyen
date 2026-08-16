import { Module } from '@nestjs/common';
import { PrismaModule } from '@/infrastructure/database';
import { AnalyticsAggregationService } from './infrastructure/analytics-aggregation.service';
import { AnalyticsDispatcherService } from './infrastructure/analytics-dispatcher.service';
import { AnalyticsMaintenanceService } from './infrastructure/analytics-maintenance.service';
import { AnalyticsProcessor } from './infrastructure/analytics.processor';
import { AnalyticsReconciliationService } from './infrastructure/analytics-reconciliation.service';

@Module({
  imports: [PrismaModule],
  providers: [
    AnalyticsAggregationService,
    AnalyticsReconciliationService,
    AnalyticsProcessor,
    AnalyticsDispatcherService,
    AnalyticsMaintenanceService,
  ],
})
export class AnalyticsWorkerModule {}
