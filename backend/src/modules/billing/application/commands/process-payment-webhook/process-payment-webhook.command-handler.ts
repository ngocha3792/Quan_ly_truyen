import { createHash } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import {
  BILLING_PERSISTENCE_PORT,
  type BillingPersistencePort,
  PAYMENT_PROVIDER_REGISTRY_PORT,
  type PaymentProviderRegistryPort,
} from '../../ports';
import { ProcessPaymentWebhookCommand } from './process-payment-webhook.command';

@Injectable()
export class ProcessPaymentWebhookCommandHandler {
  constructor(
    @Inject(PAYMENT_PROVIDER_REGISTRY_PORT)
    private readonly providers: PaymentProviderRegistryPort,
    @Inject(BILLING_PERSISTENCE_PORT)
    private readonly persistence: BillingPersistencePort,
  ) {}

  async execute(
    command: ProcessPaymentWebhookCommand,
  ): Promise<{ received: true; duplicate: boolean }> {
    const connection = await this.persistence.getConnectionByCode(
      command.providerCode,
    );
    if (!connection.enabled)
      throw new Error('Payment provider connection is disabled');
    const provider = this.providers.getAdapter(connection.kind);
    if (!provider.supportsWebhook) {
      throw new Error('Payment provider does not support webhooks');
    }
    const event = await provider.verifyWebhook({
      providerCode: command.providerCode,
      rawBody: command.rawBody,
      headers: command.headers,
    });
    const payloadHash = createHash('sha256')
      .update(command.rawBody)
      .digest('hex');
    const result = await this.persistence.receiveWebhookEvent({
      provider: connection.code,
      event,
      payloadHash,
    });
    return { received: true, duplicate: result.duplicate };
  }
}
