import { Inject, Injectable } from '@nestjs/common';

import type { BillingRefund } from '@/generated/prisma/client';
import { PrismaService } from '@/infrastructure/database';

import type { BillingRefundRecord } from '../../application/ports/billing-gateway.persistence.port';
import {
  PAYMENT_CREDENTIAL_VAULT_PORT,
  type PaymentCredentialVaultPort,
} from '../../application/ports/payment-credential-vault.port';
import type { PaymentQueryResult } from '../../application/ports/payment-provider.port';
import {
  BillingResourceNotFoundException,
  PaymentProviderUnavailableException,
} from '../../domain';
import { lockPaymentSettlement } from './billing-refund-ledger';

@Injectable()
export class BillingGatewayReader {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_CREDENTIAL_VAULT_PORT)
    private readonly vault: PaymentCredentialVaultPort,
  ) {}

  async getOrder(orderId: string) {
    const order = await this.prisma.paymentOrder.findUnique({
      where: { id: orderId },
      include: { providerConnection: true },
    });
    if (!order)
      throw new BillingResourceNotFoundException('đơn thanh toán', orderId);
    const connection = order.providerConnection;
    if (
      !connection ||
      !order.providerReference ||
      connection.kind !== 'VNPAY'
    ) {
      throw new PaymentProviderUnavailableException(
        'Đơn không thuộc cổng thanh toán hỗ trợ đối soát/hoàn tiền',
      );
    }
    const snapshot = order.providerConfigSnapshot ?? connection.config;
    const config =
      snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)
        ? (snapshot as Readonly<Record<string, unknown>>)
        : {};
    return {
      orderId,
      status: order.status,
      providerReference: order.providerReference,
      amountMinor: order.fiatAmountMinor,
      currency: order.currency,
      createdAt: order.createdAt,
      ...(order.providerTransactionId
        ? { providerTransactionId: order.providerTransactionId }
        : {}),
      connection: {
        id: connection.id,
        code: order.provider,
        kind: connection.kind,
        displayName: connection.displayName,
        currency: order.currency,
        orderTtlMinutes: connection.orderTtlMinutes,
        config,
        secrets: this.vault.open(
          order.provider,
          order.providerCredentialSnapshot ?? connection.encryptedCredential,
        ),
      },
    };
  }

  async listRefunds(orderId: string): Promise<readonly BillingRefundRecord[]> {
    return (
      await this.prisma.billingRefund.findMany({
        where: { orderId },
        orderBy: { createdAt: 'desc' },
        take: 100,
      })
    ).map(toBillingRefund);
  }

  async recordReconciliation(
    actorId: string,
    orderId: string,
    result: PaymentQueryResult,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await lockPaymentSettlement(tx, orderId);
      if (result.status === 'FAILED')
        await tx.paymentOrder.updateMany({
          where: { id: orderId, status: { in: ['CREATED', 'PENDING'] } },
          data: { status: 'FAILED', failureCode: 'PROVIDER_REPORTED_FAILURE' },
        });
      await tx.paymentOrder.update({
        where: { id: orderId },
        data: {
          reconciledAt: new Date(),
          ...(result.status === 'SUCCEEDED' && result.providerTransactionId
            ? {
                providerTransactionId: result.providerTransactionId,
                providerTransactionDate: result.event?.providerTransactionDate,
              }
            : {}),
        },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'payment.order.reconciled',
          entityType: 'payment_order',
          entityId: orderId,
          newValues: {
            providerStatus: result.status,
            responseCode: result.responseCode,
          },
        },
      });
    });
  }
}

export function toBillingRefund(row: BillingRefund): BillingRefundRecord {
  return {
    id: row.id,
    orderId: row.orderId,
    actorId: row.actorId,
    idempotencyKey: row.idempotencyKey,
    status: row.status,
    amountMinor: row.amountMinor.toString(),
    creditAmount: row.creditAmount.toString(),
    currency: row.currency,
    reason: row.reason,
    providerRefundId: row.providerRefundId,
    responseCode: row.responseCode,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}
