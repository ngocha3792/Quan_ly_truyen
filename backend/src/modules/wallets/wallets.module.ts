import { Module } from '@nestjs/common';

import { PrismaModule } from '@/infrastructure/database';
import { AuthAuthorizationModule } from '@/modules/auth';

import {
  GetMyWalletQueryHandler,
  ListMyWalletTransactionsQueryHandler,
  PostWalletTransactionCommandHandler,
  ReconcileWalletQueryHandler,
  WALLET_PERSISTENCE_PORT,
} from './application';
import { PrismaWalletPersistence } from './infrastructure';
import { MonetizationEnabledGuard, WalletsController } from './presentation';

@Module({
  imports: [PrismaModule, AuthAuthorizationModule],
  controllers: [WalletsController],
  providers: [
    GetMyWalletQueryHandler,
    ListMyWalletTransactionsQueryHandler,
    PostWalletTransactionCommandHandler,
    ReconcileWalletQueryHandler,
    MonetizationEnabledGuard,
    PrismaWalletPersistence,
    {
      provide: WALLET_PERSISTENCE_PORT,
      useExisting: PrismaWalletPersistence,
    },
  ],
  exports: [PostWalletTransactionCommandHandler, ReconcileWalletQueryHandler],
})
export class WalletsModule {}
