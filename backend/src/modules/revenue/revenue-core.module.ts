import { Module } from '@nestjs/common';
import { PrismaModule } from '@/infrastructure/database';
import { REVENUE_ALLOCATION_PORT } from './application/ports/revenue-allocation.port';
import { RevenueAllocationPersistence } from './infrastructure/persistence/revenue-allocation.persistence';

@Module({
  imports: [PrismaModule],
  providers: [
    RevenueAllocationPersistence,
    {
      provide: REVENUE_ALLOCATION_PORT,
      useExisting: RevenueAllocationPersistence,
    },
  ],
  exports: [RevenueAllocationPersistence, REVENUE_ALLOCATION_PORT],
})
export class RevenueCoreModule {}
