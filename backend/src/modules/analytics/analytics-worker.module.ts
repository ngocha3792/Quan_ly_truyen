import { Module } from '@nestjs/common';
import {
  AnalyticsDispatcherScheduler,
  AnalyticsMaintenanceScheduler,
  AnalyticsProcessor,
  PrismaAnalyticsAggregationAdapter,
  PrismaAnalyticsReconciliationAdapter,
} from './infrastructure';
import { PrismaModule } from '@/infrastructure/database';

@Module({
  imports: [PrismaModule],
  providers: [
    PrismaAnalyticsAggregationAdapter,
    PrismaAnalyticsReconciliationAdapter,
    AnalyticsProcessor,
    AnalyticsDispatcherScheduler,
    AnalyticsMaintenanceScheduler,
  ],
})
export class AnalyticsWorkerModule {}
