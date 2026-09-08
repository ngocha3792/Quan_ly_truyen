import { createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import {
  PaymentOrderStatus,
  Prisma,
  WalletCurrency,
  WalletSystemAccount,
  WalletTransactionType,
} from '@/generated/prisma/client';
import { PrismaService } from '@/infrastructure/database';
import { TransactionalReceiptService } from '@/modules/notifications';
import { MAX_WALLET_CREDIT_AMOUNT } from '@/modules/wallets';

import type { PaymentSettlementPort } from '../../application';
import {
  BillingResourceNotFoundException,
  PaymentOrderTransitionException,
} from '../../domain';

@Injectable()
export class PaymentOrderSettlementService implements PaymentSettlementPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly receipts: TransactionalReceiptService,
  ) {}

  async settleSucceeded(
    input: Parameters<PaymentSettlementPort['settleSucceeded']>[0],
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`
        SELECT pg_advisory_xact_lock(hashtext('payment-settlement:' || ${input.orderId}))
      `);
      const order = await tx.paymentOrder.findUnique({
        where: { id: input.orderId },
      });
      if (!order)
        throw new BillingResourceNotFoundException(
          'đơn thanh toán',
          input.orderId,
        );
      const terminalStatuses = new Set<PaymentOrderStatus>([
        PaymentOrderStatus.PAID,
        PaymentOrderStatus.REFUNDED,
        PaymentOrderStatus.REVERSED,
      ]);
      if (terminalStatuses.has(order.status)) return;
      const accepted: PaymentOrderStatus[] =
        input.source === 'admin_manual'
          ? [PaymentOrderStatus.AWAITING_REVIEW]
          : [PaymentOrderStatus.PENDING, PaymentOrderStatus.AWAITING_REVIEW];
      if (!accepted.includes(order.status)) {
        throw new PaymentOrderTransitionException(
          order.status,
          PaymentOrderStatus.PAID,
        );
      }

      await tx.$executeRaw(Prisma.sql`
        SELECT pg_advisory_xact_lock(hashtext('wallet:' || ${order.userId} || ':CREDIT'))
      `);
      const wallet = await tx.wallet.upsert({
        where: {
          userId_currency: {
            userId: order.userId,
            currency: WalletCurrency.CREDIT,
          },
        },
        create: { userId: order.userId, currency: WalletCurrency.CREDIT },
        update: {},
        select: { id: true, balance: true },
      });
      const balanceAfter = wallet.balance + order.creditAmount;
      if (balanceAfter > MAX_WALLET_CREDIT_AMOUNT) {
        throw new PaymentOrderTransitionException(
          order.status,
          'WALLET_LIMIT_EXCEEDED',
        );
      }
      const idempotencyKey = `payment-order:${order.id}`;
      const existing = await tx.walletLedgerTransaction.findUnique({
        where: { idempotencyKey },
        select: { id: true },
      });
      let transactionId = existing?.id;
      if (!transactionId) {
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: balanceAfter, version: { increment: 1 } },
        });
        const transaction = await tx.walletLedgerTransaction.create({
          data: {
            walletId: wallet.id,
            currency: WalletCurrency.CREDIT,
            type: WalletTransactionType.TOP_UP,
            idempotencyKey,
            requestHash: walletRequestHash(
              order.userId,
              order.id,
              order.creditAmount,
            ),
            referenceType: 'payment_order',
            referenceId: order.id,
            walletAmount: order.creditAmount,
            walletBalanceAfter: balanceAfter,
            metadata: {
              provider: order.provider,
              providerReference: input.providerReference,
            },
            entries: {
              create: [
                {
                  walletId: wallet.id,
                  currency: WalletCurrency.CREDIT,
                  amount: order.creditAmount,
                },
                {
                  systemAccount: WalletSystemAccount.PAYMENT_CLEARING,
                  currency: WalletCurrency.CREDIT,
                  amount: -order.creditAmount,
                },
              ],
            },
          },
          select: { id: true },
        });
        transactionId = transaction.id;
      }

      const updated = await tx.paymentOrder.updateMany({
        where: { id: order.id, status: { in: accepted } },
        data: {
          status: PaymentOrderStatus.PAID,
          walletTransactionId: transactionId,
          settledAt: input.occurredAt,
          failureCode: null,
          ...(input.source === 'admin_manual'
            ? {
                reviewedById: input.actorId,
                reviewedAt: input.occurredAt,
                reviewReason: input.reason,
              }
            : {}),
        },
      });
      if (updated.count !== 1) return;

      if (input.source === 'admin_manual') {
        await tx.auditLog.create({
          data: {
            actorId: input.actorId,
            action: 'payment.order.settled.manual',
            entityType: 'payment_order',
            entityId: order.id,
            newValues: {
              reason: input.reason ?? '',
              walletTransactionId: transactionId,
            },
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
            requestId: input.requestId,
          },
        });
      }
      await this.receipts.enqueue(tx, {
        userId: order.userId,
        dedupeKey: `payment-order-paid:${order.id}`,
        type: 'credit_top_up',
        title: 'Nạp Credit thành công',
        body: `${order.creditAmount.toString()} Credit đã được cộng vào ví của bạn.`,
        tag: 'Nạp Credit',
        transactionId,
        amountCredits: order.creditAmount,
        data: { paymentOrderId: order.id, provider: order.provider },
      });
    });
  }
}

function walletRequestHash(
  userId: string,
  orderId: string,
  amount: bigint,
): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        userId,
        'CREDIT',
        'TOP_UP',
        'CREDIT',
        amount.toString(),
        'PAYMENT_CLEARING',
        'payment_order',
        orderId,
      ]),
    )
    .digest('hex');
}
