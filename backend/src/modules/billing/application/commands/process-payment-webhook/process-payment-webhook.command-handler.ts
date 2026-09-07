import { createHash } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import {
  BILLING_PERSISTENCE_PORT,
  type BillingPersistencePort,
  PAYMENT_PROVIDER_PORT,
  type PaymentProviderPort,
} from '../../ports';
import { ProcessPaymentWebhookCommand } from './process-payment-webhook.command';

@Injectable()
export class ProcessPaymentWebhookCommandHandler {
  constructor(
    @Inject(PAYMENT_PROVIDER_PORT)
    private readonly provider: PaymentProviderPort,
    @Inject(BILLING_PERSISTENCE_PORT)
    private readonly persistence: BillingPersistencePort,
  ) {}

  async execute(
    command: ProcessPaymentWebhookCommand,
  ): Promise<{ received: true; duplicate: boolean }> {
    const event = this.provider.verifyWebhook({
      providerCode: command.providerCode,
      rawBody: command.rawBody,
      timestamp: command.timestamp,
      signature: command.signature,
    });
    const payloadHash = createHash('sha256')
      .update(command.rawBody)
      .digest('hex');
    const result = await this.persistence.receiveWebhookEvent({
      provider: this.provider.code,
      event,
      payloadHash,
    });
    return { received: true, duplicate: result.duplicate };
  }
}
