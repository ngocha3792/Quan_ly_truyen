import { Module } from '@nestjs/common';

import { PrismaModule } from '@/infrastructure/database';
import { AuthAuthorizationModule } from '@/modules/auth';
import { AuthorsModule } from '@/modules/authors';
import { NotificationsModule } from '@/modules/notifications';

import {
  ListMyPurchasesQueryHandler,
  GetChapterMonetizationQueryHandler,
  ListPriceBandsQueryHandler,
  MONETIZATION_PERSISTENCE_PORT,
  SetChapterMonetizationCommandHandler,
  UnlockChapterCommandHandler,
  UpdatePriceBandCommandHandler,
  ListAdminPurchasesQueryHandler,
  RefundChapterPurchaseCommandHandler,
  GetRevenueAnalyticsQueryHandler,
} from './application';
import {
  MonetizationIntegrityMetricsObserver,
  PrismaMonetizationPersistence,
} from './infrastructure';
import {
  AdminMonetizationController,
  AdminMonetizationOperationsController,
  AuthorMonetizationController,
  AuthorPricingFeatureGuard,
  MonetizationFeatureGuard,
  ReaderMonetizationController,
} from './presentation';
import { MonetizationSecurityModule } from './monetization-security.module';

@Module({
  imports: [
    PrismaModule,
    AuthAuthorizationModule,
    AuthorsModule,
    NotificationsModule,
    MonetizationSecurityModule,
  ],
  controllers: [
    ReaderMonetizationController,
    AuthorMonetizationController,
    AdminMonetizationController,
    AdminMonetizationOperationsController,
  ],
  providers: [
    ListPriceBandsQueryHandler,
    ListMyPurchasesQueryHandler,
    GetChapterMonetizationQueryHandler,
    SetChapterMonetizationCommandHandler,
    UnlockChapterCommandHandler,
    UpdatePriceBandCommandHandler,
    ListAdminPurchasesQueryHandler,
    RefundChapterPurchaseCommandHandler,
    GetRevenueAnalyticsQueryHandler,
    MonetizationFeatureGuard,
    AuthorPricingFeatureGuard,
    MonetizationIntegrityMetricsObserver,
    PrismaMonetizationPersistence,
    {
      provide: MONETIZATION_PERSISTENCE_PORT,
      useExisting: PrismaMonetizationPersistence,
    },
  ],
})
export class MonetizationModule {}
