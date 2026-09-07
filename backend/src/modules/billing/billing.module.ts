import { Module } from '@nestjs/common';

import { PrismaModule } from '@/infrastructure/database';
import { AuthAuthorizationModule } from '@/modules/auth';
import { WalletsModule } from '@/modules/wallets';

import {
  BILLING_PERSISTENCE_PORT,
  CreatePaymentOrderCommandHandler,
  GetOwnPaymentOrderQueryHandler,
  ListCreditPackagesQueryHandler,
  ListOwnPaymentOrdersQueryHandler,
  PAYMENT_PROVIDER_PORT,
  ProcessPaymentWebhookCommandHandler,
  ReconcilePaymentsQueryHandler,
  UpdateCreditPackageCommandHandler,
} from './application';
import {
  ConfiguredPaymentProviderAdapter,
  PaymentWebhookInboxProcessor,
  PrismaBillingPersistence,
} from './infrastructure';
import {
  AdminBillingController,
  BillingController,
  PaymentProviderFeatureGuard,
  PaymentWebhookController,
} from './presentation';

@Module({
  imports: [PrismaModule, AuthAuthorizationModule, WalletsModule],
  controllers: [
    BillingController,
    AdminBillingController,
    PaymentWebhookController,
  ],
  providers: [
    CreatePaymentOrderCommandHandler,
    ProcessPaymentWebhookCommandHandler,
    UpdateCreditPackageCommandHandler,
    GetOwnPaymentOrderQueryHandler,
    ListCreditPackagesQueryHandler,
    ListOwnPaymentOrdersQueryHandler,
    ReconcilePaymentsQueryHandler,
    PaymentProviderFeatureGuard,
    PrismaBillingPersistence,
    ConfiguredPaymentProviderAdapter,
    PaymentWebhookInboxProcessor,
    {
      provide: BILLING_PERSISTENCE_PORT,
      useExisting: PrismaBillingPersistence,
    },
    {
      provide: PAYMENT_PROVIDER_PORT,
      useExisting: ConfiguredPaymentProviderAdapter,
    },
  ],
  exports: [PaymentWebhookInboxProcessor],
})
export class BillingModule {}
