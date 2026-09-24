import { Module } from '@nestjs/common';
import { RevenueCoreModule } from './revenue-core.module';
import { RevenueSettlementWorker } from './infrastructure/jobs/revenue-settlement.worker';

@Module({ imports: [RevenueCoreModule], providers: [RevenueSettlementWorker] })
export class RevenueWorkerModule {}
