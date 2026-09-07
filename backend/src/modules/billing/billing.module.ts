import { Module } from '@nestjs/common';

import { PrismaModule } from '@/infrastructure/database';
import { AuthAuthorizationModule } from '@/modules/auth';
import { WalletsModule } from '@/modules/wallets';
import { NotificationsModule } from '@/modules/notifications';
import { MonetizationSecurityModule } from '@/modules/monetization';

import {
  BILLING_PERSISTENCE_PORT,
  CreatePaymentOrderCommandHandler,
  GetOwnPaymentOrderQueryHandler,
  ListCreditPackagesQueryHandler,
  ListOwnPaymentOrdersQueryHandler,
  ListAdminPaymentOrdersQueryHandler,
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
  BillingOperationsFeatureGuard,
  BillingController,
  PaymentProviderFeatureGuard,
  PaymentWebhookController,
} from './presentation';

@Module({
  imports: [
    PrismaModule,
    AuthAuthorizationModule,
    WalletsModule,
    NotificationsModule,
    MonetizationSecurityModule,
  ],
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
    ListAdminPaymentOrdersQueryHandler,
    ReconcilePaymentsQueryHandler,
    BillingOperationsFeatureGuard,
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
