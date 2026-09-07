import { Module } from '@nestjs/common';
import {
  AnalyticsDispatcherScheduler,
  AnalyticsMaintenanceScheduler,
  AnalyticsProcessor,
  PrismaAnalyticsAggregationAdapter,
  PrismaAnalyticsReconciliationAdapter,
} from './infrastructure';
import { PrismaModule } from '@/infrastructure/database';
import { RedisModule } from '@/infrastructure/cache/redis/redis.module';

@Module({
  imports: [PrismaModule, RedisModule],
  providers: [
    PrismaAnalyticsAggregationAdapter,
    PrismaAnalyticsReconciliationAdapter,
    AnalyticsProcessor,
    AnalyticsDispatcherScheduler,
    AnalyticsMaintenanceScheduler,
  ],
})
export class AnalyticsWorkerModule {}
