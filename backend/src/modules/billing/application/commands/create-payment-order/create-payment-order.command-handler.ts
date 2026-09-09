import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import {
  PAYMENT_CREDENTIAL_VAULT_PORT,
  type PaymentCredentialVaultPort,
} from '../../ports/payment-credential-vault.port';

import {
  billingConfig,
  canCreateTopUpOrder,
  monetizationConfig,
} from '@/config';

import {
  assertCreatePaymentOrderInput,
  buildPaymentOrderRequestHash,
  PaymentRolloutRestrictedException,
  requireBillingUserId,
} from '../../../domain';
import type { CreatePaymentOrderResultDto } from '../../dto';
import { toPaymentOrderResult } from '../../mappers';
import {
  BILLING_PERSISTENCE_PORT,
  type BillingPersistencePort,
  PAYMENT_PROVIDER_REGISTRY_PORT,
  type PaymentProviderRegistryPort,
} from '../../ports';
import { CreatePaymentOrderCommand } from './create-payment-order.command';

@Injectable()
export class CreatePaymentOrderCommandHandler {
  constructor(
    @Inject(BILLING_PERSISTENCE_PORT)
    private readonly persistence: BillingPersistencePort,
    @Inject(PAYMENT_PROVIDER_REGISTRY_PORT)
    private readonly providers: PaymentProviderRegistryPort,
    @Inject(billingConfig.KEY)
    private readonly config: ConfigType<typeof billingConfig>,
    @Inject(monetizationConfig.KEY)
    private readonly monetization: ConfigType<typeof monetizationConfig>,
    @Inject(PAYMENT_CREDENTIAL_VAULT_PORT)
    private readonly vault: PaymentCredentialVaultPort,
  ) {}

  async execute(
    command: CreatePaymentOrderCommand,
  ): Promise<CreatePaymentOrderResultDto> {
    const userId = requireBillingUserId(command.userId);
    const idempotencyKey = command.idempotencyKey?.trim() ?? '';
    assertCreatePaymentOrderInput({
      userId,
      packageId: command.packageId,
      idempotencyKey,
    });
    if (!canCreateTopUpOrder(this.monetization, userId)) {
      throw new PaymentRolloutRestrictedException();
    }
    const connection = await this.persistence.resolveConnection(
      command.providerConnectionId,
    );
    const provider = this.providers.getAdapter(connection.kind);
    provider.validateConfig(connection.config);
    const secrets =
      connection.kind === 'VNPAY'
        ? this.vault.open(connection.code, connection.encryptedCredential)
        : undefined;
    provider.assertReady?.({ ...connection, secrets });
    const prepared = await this.persistence.prepareOrder({
      userId,
      packageId: command.packageId,
      provider: connection.code,
      providerConnectionId: connection.id,
      storyId: command.storyId,
      providerKind: connection.kind,
      providerConfigSnapshot: connection.config,
      providerCredentialSnapshot: connection.encryptedCredential,
      idempotencyKey,
      requestHash: buildPaymentOrderRequestHash(
        userId,
        command.packageId,
        connection.id,
        command.storyId,
      ),
      ttlMinutes: connection.orderTtlMinutes ?? this.config.orderTtlMinutes,
      pendingOrderLimit: this.config.pendingOrderLimit,
    });
    if (prepared.order.status !== 'CREATED') {
      return { order: toPaymentOrderResult(prepared.order), replayed: true };
    }

    try {
      const checkout = await provider.createCheckout({
        orderId: prepared.order.id,
        userId,
        connection: {
          ...connection,
          currency: prepared.order.currency,
          config: prepared.order.providerConfigSnapshot ?? connection.config,
          secrets: prepared.order.providerCredentialSnapshot
            ? this.vault.open(
                connection.code,
                prepared.order.providerCredentialSnapshot,
              )
            : secrets,
        },
        createdAt: prepared.order.createdAt,
        ipAddress: command.ipAddress,
        amountMinor: prepared.order.fiatAmountMinor,
        currency: prepared.order.currency,
        expiresAt: prepared.order.expiresAt,
      });
      const order =
        checkout.kind === 'redirect'
          ? await this.persistence.attachCheckout({
              orderId: prepared.order.id,
              providerReference: checkout.providerReference,
              checkoutUrl: checkout.checkoutUrl,
            })
          : await this.persistence.attachInstructions({
              orderId: prepared.order.id,
              providerReference: checkout.providerReference,
              instructions: checkout.instructions,
            });
      return {
        order: toPaymentOrderResult(order),
        replayed: prepared.replayed,
      };
    } catch (error: unknown) {
      await this.persistence.markCheckoutFailed(
        prepared.order.id,
        error instanceof Error ? error.name.slice(0, 120) : 'PROVIDER_ERROR',
      );
      throw error;
    }
  }
}
