import { Module } from '@nestjs/common';

import { PrismaModule } from '@/infrastructure/database';
import { AuthAuthorizationModule } from '@/modules/auth';
import { AuthorsModule } from '@/modules/authors';

import {
  ListMyPurchasesQueryHandler,
  GetChapterMonetizationQueryHandler,
  ListPriceBandsQueryHandler,
  MONETIZATION_PERSISTENCE_PORT,
  SetChapterMonetizationCommandHandler,
  UnlockChapterCommandHandler,
  UpdatePriceBandCommandHandler,
} from './application';
import { PrismaMonetizationPersistence } from './infrastructure';
import {
  AdminMonetizationController,
  AuthorMonetizationController,
  AuthorPricingFeatureGuard,
  MonetizationFeatureGuard,
  ReaderMonetizationController,
} from './presentation';

@Module({
  imports: [PrismaModule, AuthAuthorizationModule, AuthorsModule],
  controllers: [
    ReaderMonetizationController,
    AuthorMonetizationController,
    AdminMonetizationController,
  ],
  providers: [
    ListPriceBandsQueryHandler,
    ListMyPurchasesQueryHandler,
    GetChapterMonetizationQueryHandler,
    SetChapterMonetizationCommandHandler,
    UnlockChapterCommandHandler,
    UpdatePriceBandCommandHandler,
    MonetizationFeatureGuard,
    AuthorPricingFeatureGuard,
    PrismaMonetizationPersistence,
    {
      provide: MONETIZATION_PERSISTENCE_PORT,
      useExisting: PrismaMonetizationPersistence,
    },
  ],
})
export class MonetizationModule {}
