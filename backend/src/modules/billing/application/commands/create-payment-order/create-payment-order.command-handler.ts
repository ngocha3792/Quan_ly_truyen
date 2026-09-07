import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

import { billingConfig } from '@/config';

import {
  assertCreatePaymentOrderInput,
  buildPaymentOrderRequestHash,
  requireBillingUserId,
} from '../../../domain';
import type { CreatePaymentOrderResultDto } from '../../dto';
import { toPaymentOrderResult } from '../../mappers';
import {
  BILLING_PERSISTENCE_PORT,
  type BillingPersistencePort,
  PAYMENT_PROVIDER_PORT,
  type PaymentProviderPort,
} from '../../ports';
import { CreatePaymentOrderCommand } from './create-payment-order.command';

@Injectable()
export class CreatePaymentOrderCommandHandler {
  constructor(
    @Inject(BILLING_PERSISTENCE_PORT)
    private readonly persistence: BillingPersistencePort,
    @Inject(PAYMENT_PROVIDER_PORT)
    private readonly provider: PaymentProviderPort,
    @Inject(billingConfig.KEY)
    private readonly config: ConfigType<typeof billingConfig>,
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
    const prepared = await this.persistence.prepareOrder({
      userId,
      packageId: command.packageId,
      provider: this.provider.code,
      idempotencyKey,
      requestHash: buildPaymentOrderRequestHash(userId, command.packageId),
      ttlMinutes: this.config.orderTtlMinutes,
      pendingOrderLimit: this.config.pendingOrderLimit,
    });
    if (prepared.order.status !== 'CREATED') {
      return { order: toPaymentOrderResult(prepared.order), replayed: true };
    }

    try {
      const checkout = await this.provider.createCheckout({
        orderId: prepared.order.id,
        amountMinor: prepared.order.fiatAmountMinor,
        currency: prepared.order.currency,
        expiresAt: prepared.order.expiresAt,
      });
      const order = await this.persistence.attachCheckout({
        orderId: prepared.order.id,
        ...checkout,
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
