import { Module } from '@nestjs/common';
import {
  VnpayPaymentProviderAdapter,
  VnpayOperationsClient,
} from './infrastructure/provider';
import { PaymentCredentialVault } from './infrastructure/provider/payment-credential-vault';
import { PAYMENT_CREDENTIAL_VAULT_PORT } from './application/ports/payment-credential-vault.port';
import { PAYMENT_ROLLOUT_PORT } from './application/ports/payment-rollout.port';
import { PrismaPaymentRolloutPersistence } from './infrastructure/persistence/prisma-payment-rollout.persistence';
import { AdminPaymentRolloutController } from './presentation/http/controllers/admin-payment-rollout.controller';
import { VnpayIpnController } from './presentation/http/controllers/vnpay-ipn.controller';
import { VnpayIpnService } from './infrastructure/webhook/vnpay-ipn.service';
import { PAYMENT_IPN_PORT } from './application/ports/payment-ipn.port';
import { BILLING_GATEWAY_PROVIDERS } from './infrastructure/gateway';
import { AdminPaymentGatewayController } from './presentation/http/controllers/admin-payment-gateway.controller';

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
    AdminPaymentGatewayController,
    VnpayIpnController,
    AdminPaymentRolloutController,
    BillingController,
    AdminBillingController,
    AdminPaymentProvidersController,
    PaymentWebhookController,
  ],
  providers: [
    ...BILLING_GATEWAY_PROVIDERS,
    VnpayIpnService,
    { provide: PAYMENT_IPN_PORT, useExisting: VnpayIpnService },
    VnpayPaymentProviderAdapter,
    VnpayOperationsClient,
    PaymentCredentialVault,
    PrismaPaymentRolloutPersistence,
    {
      provide: PAYMENT_CREDENTIAL_VAULT_PORT,
      useExisting: PaymentCredentialVault,
    },
    {
      provide: PAYMENT_ROLLOUT_PORT,
      useExisting: PrismaPaymentRolloutPersistence,
    },
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
