import { Prisma } from '../../src/generated/prisma/client';
import { createScriptPrismaClient } from '../shared/prisma-client';
import { ScriptError, ScriptExitCode } from '../shared/script-error';
import { runScript } from '../shared/script-runner';

const prisma = createScriptPrismaClient();

interface WalletMismatchRow {
  walletId: string;
  userId: string;
  currency: string;
  materializedBalance: bigint;
  ledgerBalance: bigint;
  transactionCount: bigint;
  balancedTransactionCount: bigint;
}

void runScript({
  name: 'reconcile-wallet-ledger',

  async execute({ logger }) {
    const walletId = readOption('wallet-id');
    const rows = await prisma.$queryRaw<WalletMismatchRow[]>(Prisma.sql`
      WITH transaction_summary AS (
        SELECT
          ledger_transaction."id",
          ledger_transaction."wallet_id" AS "walletId",
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
        GROUP BY ledger_transaction."id"
      ),
      transaction_counts AS (
        SELECT
          "walletId",
          COUNT(*)::bigint AS "transactionCount",
          COUNT(*) FILTER (
            WHERE "entryCount" = 2
              AND "entrySum" = 0
              AND "walletEntryCount" = 1
              AND "systemEntryCount" = 1
              AND "walletEntryAmount" = "walletAmount"
          )::bigint AS "balancedTransactionCount"
        FROM transaction_summary
        GROUP BY "walletId"
      ),
      ledger_balances AS (
        SELECT
          "wallet_id" AS "walletId",
          COALESCE(SUM("amount"), 0)::bigint AS "ledgerBalance"
        FROM "wallet_ledger_entries"
        WHERE "wallet_id" IS NOT NULL
        GROUP BY "wallet_id"
      ),
      wallet_summary AS (
        SELECT
          wallet."id" AS "walletId",
          wallet."user_id" AS "userId",
          wallet."currency"::text AS "currency",
          wallet."balance" AS "materializedBalance",
          COALESCE(ledger_balances."ledgerBalance", 0)::bigint AS "ledgerBalance",
          COALESCE(transaction_counts."transactionCount", 0)::bigint AS "transactionCount",
          COALESCE(transaction_counts."balancedTransactionCount", 0)::bigint AS "balancedTransactionCount"
        FROM "wallets" AS wallet
        LEFT JOIN ledger_balances
          ON ledger_balances."walletId" = wallet."id"
        LEFT JOIN transaction_counts
          ON transaction_counts."walletId" = wallet."id"
        WHERE ${walletId ? Prisma.sql`wallet."id" = ${walletId}::uuid` : Prisma.sql`TRUE`}
      )
      SELECT *
      FROM wallet_summary
      WHERE "materializedBalance" <> "ledgerBalance"
        OR "transactionCount" <> "balancedTransactionCount"
      ORDER BY "walletId"
    `);

    for (const row of rows) {
      logger.warn('wallet ledger mismatch', {
        walletId: row.walletId,
        userId: row.userId,
        currency: row.currency,
        materializedBalance: row.materializedBalance.toString(),
        ledgerBalance: row.ledgerBalance.toString(),
        transactionCount: row.transactionCount.toString(),
        balancedTransactionCount: row.balancedTransactionCount.toString(),
      });
    }

    logger.info('wallet ledger reconciliation finished', {
      walletFilter: walletId ?? 'all',
      mismatches: rows.length,
    });

    if (rows.length > 0) {
      throw new ScriptError(
        `Wallet ledger reconciliation found ${rows.length} mismatch(es)`,
        ScriptExitCode.INTEGRITY_FAILURE,
      );
    }
  },

  cleanup: () => prisma.$disconnect(),
});

function readOption(name: string): string | undefined {
  const marker = `--${name}`;
  const index = process.argv.indexOf(marker);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
