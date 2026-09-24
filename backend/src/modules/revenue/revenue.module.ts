import { Module } from '@nestjs/common';
import { PrismaModule } from '@/infrastructure/database';
import { AuthAuthorizationModule } from '@/modules/auth';
import { RevenueCoreModule } from './revenue-core.module';
import { ManageRevenueAgreementsCommandHandler } from './application/commands/manage-revenue-agreements.command-handler';
import {
  AdminRevenueAgreementController,
  AuthorRevenueAgreementController,
} from './presentation/http/controllers/revenue-agreement.controller';
import {
  AdminRevenuePayoutController,
  AuthorRevenuePayoutController,
} from './presentation/http/controllers/revenue-payout.controller';
import { RevenuePayoutCommandHandler } from './application/commands/revenue-payout.command-handler';
import { RevenuePayoutQueryHandler } from './application/queries/revenue-payout.query-handler';
import { PrismaRevenuePayoutPersistence } from './infrastructure/persistence/prisma-revenue-payout.persistence';
import { REVENUE_PAYOUT_PORT } from './application/ports/revenue-payout.persistence.port';

@Module({
  imports: [PrismaModule, AuthAuthorizationModule, RevenueCoreModule],
  controllers: [
    AuthorRevenuePayoutController,
    AdminRevenuePayoutController,
    AdminRevenueAgreementController,
    AuthorRevenueAgreementController,
  ],
  providers: [
    ManageRevenueAgreementsCommandHandler,
    RevenuePayoutCommandHandler,
    RevenuePayoutQueryHandler,
    PrismaRevenuePayoutPersistence,
    {
      provide: REVENUE_PAYOUT_PORT,
      useExisting: PrismaRevenuePayoutPersistence,
    },
  ],
})
export class RevenueModule {}
