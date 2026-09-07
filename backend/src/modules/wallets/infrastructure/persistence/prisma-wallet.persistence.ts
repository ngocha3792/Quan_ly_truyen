import { Injectable } from '@nestjs/common';

import {
  AppException,
  IdempotencyConflictException,
} from '@/common/exceptions';
import {
  AccountStatus,
  Prisma,
  WalletCurrency,
  WalletSystemAccount,
  WalletTransactionType,
} from '@/generated/prisma/client';
import { mapPrismaError, PrismaService } from '@/infrastructure/database';

import type {
  PostWalletTransactionInput,
  PostWalletTransactionRecord,
  WalletBalanceRecord,
  WalletPersistencePort,
  WalletReconciliationRecord,
  WalletTransactionPageRecord,
  WalletTransactionRecord,
} from '../../application';
import {
  MAX_WALLET_CREDIT_AMOUNT,
  WalletBalanceLimitExceededException,
  WalletInsufficientFundsException,
  WalletOwnerNotFoundException,
} from '../../domain';

const WALLET_TRANSACTION_SELECT = {
  id: true,
  currency: true,
  type: true,
  requestHash: true,
  walletAmount: true,
  walletBalanceAfter: true,
  referenceType: true,
  referenceId: true,
  createdAt: true,
} satisfies Prisma.WalletLedgerTransactionSelect;

type WalletTransactionRow = Prisma.WalletLedgerTransactionGetPayload<{
  select: typeof WALLET_TRANSACTION_SELECT;
}>;

interface ReconciliationCountRow {
  transactionCount: bigint;
  balancedTransactionCount: bigint;
}

@Injectable()
export class PrismaWalletPersistence implements WalletPersistencePort {
  constructor(private readonly prisma: PrismaService) {}

  async findBalance(
    userId: string,
    currency: 'CREDIT',
  ): Promise<WalletBalanceRecord> {
    try {
      const wallet = await this.prisma.wallet.findUnique({
        where: {
          userId_currency: {
            userId,
            currency: toPrismaCurrency(currency),
          },
        },
        select: {
          balance: true,
          version: true,
          updatedAt: true,
        },
      });

      return {
        userId,
        currency,
        balance: wallet?.balance ?? 0n,
        version: wallet?.version ?? 0,
        updatedAt: wallet?.updatedAt ?? null,
      };
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'wallet-read-own',
        resource: 'Ví',
      });
    }
  }

  async listTransactions(input: {
    userId: string;
    currency: 'CREDIT';
    page: number;
    pageSize: number;
  }): Promise<WalletTransactionPageRecord> {
    try {
      const wallet = await this.prisma.wallet.findUnique({
        where: {
          userId_currency: {
            userId: input.userId,
            currency: toPrismaCurrency(input.currency),
          },
        },
        select: { id: true },
      });

      if (!wallet) {
        return {
          items: [],
          page: input.page,
          pageSize: input.pageSize,
          total: 0,
        };
      }

      const where = {
        walletId: wallet.id,
      } satisfies Prisma.WalletLedgerTransactionWhereInput;
      const [rows, total] = await Promise.all([
        this.prisma.walletLedgerTransaction.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          select: WALLET_TRANSACTION_SELECT,
        }),
        this.prisma.walletLedgerTransaction.count({ where }),
      ]);

      return {
        items: rows.map(toTransactionRecord),
        page: input.page,
        pageSize: input.pageSize,
        total,
      };
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'wallet-list-transactions-own',
        resource: 'Lịch sử ví',
      });
    }
  }

  async postTransaction(
    input: PostWalletTransactionInput,
  ): Promise<PostWalletTransactionRecord> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await lockIdempotencyKey(tx, input.idempotencyKey);

        const existing = await tx.walletLedgerTransaction.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          select: WALLET_TRANSACTION_SELECT,
        });
        if (existing) {
          if (existing.requestHash !== input.requestHash) {
            throw new IdempotencyConflictException({
              key: input.idempotencyKey,
              existingRequestHash: existing.requestHash,
              currentRequestHash: input.requestHash,
            });
          }

          return {
            transaction: toTransactionRecord(existing),
            replayed: true,
          };
        }

        await lockWallet(tx, input.userId, input.currency);

        const owner = await tx.user.findFirst({
          where: {
            id: input.userId,
            status: AccountStatus.ACTIVE,
            deletedAt: null,
          },
          select: { id: true },
        });
        if (!owner) {
          throw new WalletOwnerNotFoundException(input.userId);
        }

        const currency = toPrismaCurrency(input.currency);
        const wallet = await tx.wallet.upsert({
          where: {
            userId_currency: { userId: input.userId, currency },
          },
          create: { userId: input.userId, currency },
          update: {},
          select: { id: true, balance: true },
        });
        const balanceAfter = wallet.balance + input.walletAmount;
        if (balanceAfter < 0n) {
          throw new WalletInsufficientFundsException({
            available: wallet.balance,
            required: -input.walletAmount,
          });
        }
        if (balanceAfter > MAX_WALLET_CREDIT_AMOUNT) {
          throw new WalletBalanceLimitExceededException(
            MAX_WALLET_CREDIT_AMOUNT,
          );
        }

        await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            balance: balanceAfter,
            version: { increment: 1 },
          },
        });

        const transaction = await tx.walletLedgerTransaction.create({
          data: {
            walletId: wallet.id,
            currency,
            type: toPrismaTransactionType(input.type),
            idempotencyKey: input.idempotencyKey,
            requestHash: input.requestHash,
            referenceType: input.referenceType,
            referenceId: input.referenceId,
            walletAmount: input.walletAmount,
            walletBalanceAfter: balanceAfter,
            ...(input.metadata ? { metadata: input.metadata } : {}),
            entries: {
              create: [
                {
                  walletId: wallet.id,
                  currency,
                  amount: input.walletAmount,
                },
                {
                  systemAccount: toPrismaSystemAccount(input.systemAccount),
                  currency,
                  amount: -input.walletAmount,
                },
              ],
            },
          },
          select: WALLET_TRANSACTION_SELECT,
        });

        return {
          transaction: toTransactionRecord(transaction),
          replayed: false,
        };
      });
    } catch (error: unknown) {
      if (error instanceof AppException) {
        throw error;
      }
      throw mapPrismaError(error, {
        operation: 'wallet-post-ledger-transaction',
        resource: 'Giao dịch ví',
      });
    }
  }

  async reconcile(
    userId: string,
    currency: 'CREDIT',
  ): Promise<WalletReconciliationRecord> {
    try {
      const wallet = await this.prisma.wallet.findUnique({
        where: {
          userId_currency: {
            userId,
            currency: toPrismaCurrency(currency),
          },
        },
        select: { id: true, balance: true },
      });

      if (!wallet) {
        return {
          userId,
          currency,
          materializedBalance: 0n,
          ledgerBalance: 0n,
          transactionCount: 0,
          balancedTransactionCount: 0,
        };
      }

      const aggregate = await this.prisma.walletLedgerEntry.aggregate({
        where: { walletId: wallet.id },
        _sum: { amount: true },
      });
      const counts = await this.prisma.$queryRaw<ReconciliationCountRow[]>(
        Prisma.sql`
          SELECT
            COUNT(*)::bigint AS "transactionCount",
            COUNT(*) FILTER (
              WHERE summary."entryCount" = 2
                AND summary."entrySum" = 0
                AND summary."walletEntryCount" = 1
                AND summary."systemEntryCount" = 1
                AND summary."walletEntryAmount" = summary."walletAmount"
            )::bigint AS "balancedTransactionCount"
          FROM (
            SELECT
              ledger_transaction."id",
              ledger_transaction."wallet_amount" AS "walletAmount",
              COUNT(ledger_entry."id") AS "entryCount",
              COALESCE(SUM(ledger_entry."amount"), 0) AS "entrySum",
              COUNT(ledger_entry."id") FILTER (
                WHERE ledger_entry."wallet_id" = ledger_transaction."wallet_id"
              ) AS "walletEntryCount",
              COUNT(ledger_entry."id") FILTER (
                WHERE ledger_entry."system_account" IS NOT NULL
              ) AS "systemEntryCount",
              COALESCE(SUM(ledger_entry."amount") FILTER (
                WHERE ledger_entry."wallet_id" = ledger_transaction."wallet_id"
              ), 0) AS "walletEntryAmount"
            FROM "wallet_ledger_transactions" AS ledger_transaction
            LEFT JOIN "wallet_ledger_entries" AS ledger_entry
              ON ledger_entry."transaction_id" = ledger_transaction."id"
            WHERE ledger_transaction."wallet_id" = ${wallet.id}::uuid
            GROUP BY ledger_transaction."id"
          ) AS summary
        `,
      );
      const row = counts[0] ?? {
        transactionCount: 0n,
        balancedTransactionCount: 0n,
      };

      return {
        userId,
        currency,
        materializedBalance: wallet.balance,
        ledgerBalance: aggregate._sum.amount ?? 0n,
        transactionCount: Number(row.transactionCount),
        balancedTransactionCount: Number(row.balancedTransactionCount),
      };
    } catch (error: unknown) {
      throw mapPrismaError(error, {
        operation: 'wallet-reconcile',
        resource: 'Đối soát ví',
      });
    }
  }
}

function toTransactionRecord(
  row: WalletTransactionRow,
): WalletTransactionRecord {
  return {
    id: row.id,
    currency: row.currency,
    type: row.type,
    walletAmount: row.walletAmount,
    walletBalanceAfter: row.walletBalanceAfter,
    referenceType: row.referenceType,
    referenceId: row.referenceId,
    createdAt: row.createdAt,
  };
}

function toPrismaCurrency(currency: 'CREDIT'): WalletCurrency {
  return WalletCurrency[currency];
}

function toPrismaTransactionType(
  type: PostWalletTransactionInput['type'],
): WalletTransactionType {
  return WalletTransactionType[type];
}

function toPrismaSystemAccount(
  account: PostWalletTransactionInput['systemAccount'],
): WalletSystemAccount {
  return WalletSystemAccount[account];
}

async function lockIdempotencyKey(
  tx: Prisma.TransactionClient,
  idempotencyKey: string,
): Promise<void> {
  await tx.$executeRaw(Prisma.sql`
    SELECT pg_advisory_xact_lock(
      hashtext('wallet_idempotency:' || ${idempotencyKey})
    )
  `);
}

async function lockWallet(
  tx: Prisma.TransactionClient,
  userId: string,
  currency: string,
): Promise<void> {
  await tx.$executeRaw(Prisma.sql`
    SELECT pg_advisory_xact_lock(
      hashtext('wallet:' || ${userId} || ':' || ${currency})
    )
  `);
}
