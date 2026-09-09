import { createHash } from 'node:crypto';

import {
  Prisma,
  WalletCurrency,
  WalletSystemAccount,
  WalletTransactionType,
} from '@/generated/prisma/client';
import {
  MAX_WALLET_CREDIT_AMOUNT,
  WalletBalanceLimitExceededException,
  WalletInsufficientFundsException,
} from '@/modules/wallets';

export async function lockPaymentSettlement(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<void> {
  await tx.$executeRaw(
    Prisma.sql`SELECT pg_advisory_xact_lock(hashtext('payment-settlement:' || ${orderId}))`,
  );
}

export async function postRefundLedger(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    orderId: string;
    refundId: string;
    amount: bigint;
    release?: boolean;
  },
): Promise<void> {
  await tx.$executeRaw(
    Prisma.sql`SELECT pg_advisory_xact_lock(hashtext('wallet:' || ${input.userId} || ':CREDIT'))`,
  );
  const idempotencyKey = `${input.release ? 'billing-refund-release' : 'billing-refund-hold'}:${input.refundId}`;
  if (
    await tx.walletLedgerTransaction.findUnique({
      where: { idempotencyKey },
      select: { id: true },
    })
  )
    return;
  const wallet = await tx.wallet.upsert({
    where: {
      userId_currency: {
        userId: input.userId,
        currency: WalletCurrency.CREDIT,
      },
    },
    create: { userId: input.userId, currency: WalletCurrency.CREDIT },
    update: {},
  });
  const amount = input.release ? input.amount : -input.amount;
  const balance = wallet.balance + amount;
  if (balance < 0n)
    throw new WalletInsufficientFundsException({
      available: wallet.balance,
      required: input.amount,
    });
  if (balance > MAX_WALLET_CREDIT_AMOUNT)
    throw new WalletBalanceLimitExceededException(MAX_WALLET_CREDIT_AMOUNT);
  await tx.wallet.update({
    where: { id: wallet.id },
    data: { balance, version: { increment: 1 } },
  });
  await tx.walletLedgerTransaction.create({
    data: {
      walletId: wallet.id,
      currency: WalletCurrency.CREDIT,
      type: input.release
        ? WalletTransactionType.REVERSAL
        : WalletTransactionType.REFUND,
      idempotencyKey,
      requestHash: createHash('sha256')
        .update(`${input.userId}:${input.orderId}:${amount}`)
        .digest('hex'),
      referenceType: input.release
        ? 'billing_refund_release'
        : 'billing_refund',
      referenceId: input.refundId,
      walletAmount: amount,
      walletBalanceAfter: balance,
      metadata: { paymentOrderId: input.orderId },
      entries: {
        create: [
          { walletId: wallet.id, currency: WalletCurrency.CREDIT, amount },
          {
            systemAccount: WalletSystemAccount.PAYMENT_CLEARING,
            currency: WalletCurrency.CREDIT,
            amount: -amount,
          },
        ],
      },
    },
  });
}
