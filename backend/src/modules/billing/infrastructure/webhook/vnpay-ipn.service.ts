import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database';
import type { PaymentIpnPort } from '../../application/ports/payment-ipn.port';
import type { NormalizedPaymentEvent } from '../../application';
import {
  BILLING_PERSISTENCE_PORT,
  type BillingPersistencePort,
  PAYMENT_PROVIDER_REGISTRY_PORT,
  type PaymentProviderRegistryPort,
  PAYMENT_SETTLEMENT_PORT,
  type PaymentSettlementPort,
} from '../../application';
import {
  PAYMENT_CREDENTIAL_VAULT_PORT,
  type PaymentCredentialVaultPort,
} from '../../application/ports/payment-credential-vault.port';

@Injectable()
export class VnpayIpnService implements PaymentIpnPort {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(BILLING_PERSISTENCE_PORT)
    private readonly billing: BillingPersistencePort,
    @Inject(PAYMENT_PROVIDER_REGISTRY_PORT)
    private readonly registry: PaymentProviderRegistryPort,
    @Inject(PAYMENT_CREDENTIAL_VAULT_PORT)
    private readonly vault: PaymentCredentialVaultPort,
    @Inject(PAYMENT_SETTLEMENT_PORT)
    private readonly settlement: PaymentSettlementPort,
  ) {}

  async handle(code: string, query: Readonly<Record<string, string>>) {
    const reference = query.vnp_TxnRef ?? '';
    if (!/^[a-f0-9]{32}$/iu.test(reference))
      return reply('01', 'Order not found');
    const orderId = `${reference.slice(0, 8)}-${reference.slice(8, 12)}-${reference.slice(12, 16)}-${reference.slice(16, 20)}-${reference.slice(20)}`;
    const order = await this.prisma.paymentOrder.findUnique({
      where: { id: orderId },
      include: { providerConnection: true },
    });
    if (
      !order ||
      order.provider !== code ||
      order.providerConnection?.kind !== 'VNPAY'
    )
      return reply('01', 'Order not found');
    const connection = order.providerConnection;
    const config = order.providerConfigSnapshot ?? connection.config;
    let event: NormalizedPaymentEvent;
    try {
      event = await this.registry.getAdapter('VNPAY').verifyWebhook({
        providerCode: code,
        connection: {
          ...connection,
          currency: order.currency,
          config: config as Record<string, unknown>,
          secrets: this.vault.open(
            code,
            order.providerCredentialSnapshot ?? connection.encryptedCredential,
          ),
        },
        rawBody: Buffer.from(JSON.stringify(query)),
        headers: {},
      });
    } catch {
      return reply('97', 'Invalid signature or callback');
    }
    if (
      event.orderId !== order.id ||
      event.providerReference !== order.providerReference ||
      event.amountMinor !== order.fiatAmountMinor.toString() ||
      event.currency !== order.currency
    )
      return reply('04', 'Invalid amount or reference');
    // Stable normalized identity is independent of HTTP query field ordering.
    const payloadHash = createHash('sha256')
      .update(
        JSON.stringify([
          event.eventId,
          event.type,
          event.orderId,
          event.amountMinor,
          event.currency,
        ]),
      )
      .digest('hex');
    try {
      const persisted = await this.billing.receiveWebhookEvent({
        provider: code,
        event,
        payloadHash,
      });
      if (['PAID', 'REFUNDED', 'REVERSED'].includes(order.status))
        return reply('02', 'Order already confirmed');
      if (event.type === 'payment.succeeded') {
        await this.settlement.settleSucceeded({
          orderId: order.id,
          providerReference: event.providerReference,
          occurredAt: new Date(event.occurredAt),
          source: 'reconciliation',
          providerTransactionId: event.providerTransactionId,
          providerTransactionDate: event.providerTransactionDate,
        });
      } else {
        await this.prisma.paymentOrder.updateMany({
          where: { id: order.id, status: { in: ['CREATED', 'PENDING'] } },
          data: { status: 'FAILED', failureCode: 'VNPAY_PAYMENT_FAILED' },
        });
      }
      await this.prisma.inboundWebhookEvent.updateMany({
        where: { provider: `payment:${code}`, eventKey: event.eventId },
        data: { status: 'PROCESSED', processedAt: new Date(), lastError: null },
      });
      return reply(persisted.duplicate ? '02' : '00', 'Confirm success');
    } catch {
      return reply('99', 'Retry callback');
    }
  }
}
function reply(RspCode: string, Message: string) {
  return { RspCode, Message };
}
