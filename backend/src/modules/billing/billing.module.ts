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
  PAYMENT_PROVIDER_REGISTRY_PORT,
  PAYMENT_SETTLEMENT_PORT,
  ProcessPaymentWebhookCommandHandler,
  ReconcilePaymentsQueryHandler,
  UpdateCreditPackageCommandHandler,
  ManagePaymentProvidersCommandHandler,
  MarkPaymentOrderTransferredCommandHandler,
  ConfirmManualPaymentOrderCommandHandler,
  RejectManualPaymentOrderCommandHandler,
} from './application';
import {
  HmacSandboxPaymentProviderAdapter,
  ManualBankTransferProviderAdapter,
  PaymentProviderRegistry,
  PaymentOrderSettlementService,
  PaymentWebhookInboxProcessor,
  PrismaBillingPersistence,
} from './infrastructure';
import {
  AdminBillingController,
  AdminPaymentProvidersController,
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
    AdminPaymentProvidersController,
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
    ManagePaymentProvidersCommandHandler,
    MarkPaymentOrderTransferredCommandHandler,
    ConfirmManualPaymentOrderCommandHandler,
    RejectManualPaymentOrderCommandHandler,
    BillingOperationsFeatureGuard,
    PaymentProviderFeatureGuard,
    PrismaBillingPersistence,
    HmacSandboxPaymentProviderAdapter,
    ManualBankTransferProviderAdapter,
    PaymentProviderRegistry,
    PaymentOrderSettlementService,
    PaymentWebhookInboxProcessor,
    {
      provide: BILLING_PERSISTENCE_PORT,
      useExisting: PrismaBillingPersistence,
    },
    {
      provide: PAYMENT_PROVIDER_REGISTRY_PORT,
      useExisting: PaymentProviderRegistry,
    },
    {
      provide: PAYMENT_SETTLEMENT_PORT,
      useExisting: PaymentOrderSettlementService,
    },
  ],
  exports: [PaymentWebhookInboxProcessor],
})
export class BillingModule {}
