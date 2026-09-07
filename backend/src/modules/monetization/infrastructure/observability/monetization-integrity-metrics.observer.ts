import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

import { monetizationConfig } from '@/config';
import { Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/infrastructure/database';
import { MetricsService } from '@/infrastructure/observability';

interface IntegritySnapshotRow {
  ledgerBalance: bigint;
  walletBalance: bigint;
  chapterPurchase: bigint;
  paymentOrder: bigint;
  paymentWebhookPending: bigint;
  paymentWebhookProcessing: bigint;
  paymentWebhookFailed: bigint;
  paymentWebhookOldestSeconds: number;
}

@Injectable()
export class MonetizationIntegrityMetricsObserver
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(
    MonetizationIntegrityMetricsObserver.name,
  );
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
    @Inject(monetizationConfig.KEY)
    private readonly config: ConfigType<typeof monetizationConfig>,
  ) {}

  onModuleInit(): void {
    this.metrics.setMonetizationRollout({
      enabled: this.config.enabled,
      stage: this.config.rolloutStage,
    });
    if (!this.config.enabled) return;

    void this.refresh();
    this.timer = setInterval(
      () => void this.refresh(),
      this.config.integrityMetricsIntervalMs,
    );
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async refresh(): Promise<void> {
    try {
      const rows = await this.prisma.$queryRaw<
        IntegritySnapshotRow[]
      >(Prisma.sql`
        WITH transaction_summary AS (
          SELECT
            ledger_transaction."id",
            ledger_transaction."wallet_id",
            ledger_transaction."wallet_amount",
            COUNT(ledger_entry."id") AS entry_count,
            COALESCE(SUM(ledger_entry."amount"), 0) AS entry_sum,
            COUNT(ledger_entry."id") FILTER (
              WHERE ledger_entry."wallet_id" = ledger_transaction."wallet_id"
            ) AS wallet_entry_count,
            COUNT(ledger_entry."id") FILTER (
              WHERE ledger_entry."system_account" IS NOT NULL
            ) AS system_entry_count,
            COALESCE(SUM(ledger_entry."amount") FILTER (
              WHERE ledger_entry."wallet_id" = ledger_transaction."wallet_id"
            ), 0) AS wallet_entry_amount
          FROM "wallet_ledger_transactions" AS ledger_transaction
          LEFT JOIN "wallet_ledger_entries" AS ledger_entry
            ON ledger_entry."transaction_id" = ledger_transaction."id"
          GROUP BY ledger_transaction."id"
        ),
        ledger_balance AS (
          SELECT COUNT(*)::bigint AS mismatch_count
          FROM transaction_summary
          WHERE entry_count <> 2
             OR entry_sum <> 0
             OR wallet_entry_count <> 1
             OR system_entry_count <> 1
             OR wallet_entry_amount <> wallet_amount
        ),
        wallet_balance AS (
          SELECT COUNT(*)::bigint AS mismatch_count
          FROM "wallets" AS wallet
          LEFT JOIN (
            SELECT "wallet_id", COALESCE(SUM("amount"), 0) AS ledger_amount
            FROM "wallet_ledger_entries"
            WHERE "wallet_id" IS NOT NULL
            GROUP BY "wallet_id"
          ) AS ledger ON ledger."wallet_id" = wallet."id"
          WHERE wallet."balance" <> COALESCE(ledger.ledger_amount, 0)
        ),
        chapter_purchase AS (
          SELECT COUNT(*)::bigint AS mismatch_count
          FROM "chapter_purchases" AS purchase
          LEFT JOIN "wallet_ledger_transactions" AS debit
            ON debit."id" = purchase."wallet_transaction_id"
          LEFT JOIN "wallet_ledger_transactions" AS refund
            ON refund."id" = purchase."refund_wallet_transaction_id"
          LEFT JOIN "chapter_entitlements" AS entitlement
            ON entitlement."purchase_id" = purchase."id"
          WHERE debit."type" IS DISTINCT FROM 'chapter_purchase'
             OR debit."wallet_amount" IS DISTINCT FROM -purchase."credit_price"
             OR (
               purchase."status" = 'completed'
               AND (
                 entitlement."status" IS DISTINCT FROM 'active'
                 OR refund."id" IS NOT NULL
               )
             )
             OR (
               purchase."status" = 'refunded'
               AND (
                 refund."type" IS DISTINCT FROM 'refund'
                 OR refund."wallet_amount" IS DISTINCT FROM purchase."credit_price"
                 OR (
                   entitlement."id" IS NOT NULL
                   AND entitlement."status" IS DISTINCT FROM 'revoked'
                 )
               )
             )
        ),
        payment_order AS (
          SELECT COUNT(*)::bigint AS mismatch_count
          FROM "payment_orders" AS payment
          LEFT JOIN "wallet_ledger_transactions" AS ledger_transaction
            ON ledger_transaction."id" = payment."wallet_transaction_id"
          WHERE payment."status" = 'paid'
            AND (
              ledger_transaction."type" IS DISTINCT FROM 'top_up'
              OR ledger_transaction."wallet_amount" IS DISTINCT FROM payment."credit_amount"
            )
        ),
        payment_webhook AS (
          SELECT
            COUNT(*) FILTER (WHERE "status" = 'pending')::bigint AS pending,
            COUNT(*) FILTER (WHERE "status" = 'processing')::bigint AS processing,
            COUNT(*) FILTER (WHERE "status" = 'failed')::bigint AS failed,
            COALESCE(EXTRACT(EPOCH FROM (
              NOW() - MIN("received_at") FILTER (
                WHERE "status" IN ('pending', 'failed')
              )
            )), 0)::double precision AS oldest_seconds
          FROM "inbound_webhook_events"
          WHERE "provider" LIKE 'payment:%'
        )
        SELECT
          ledger_balance.mismatch_count AS "ledgerBalance",
          wallet_balance.mismatch_count AS "walletBalance",
          chapter_purchase.mismatch_count AS "chapterPurchase",
          payment_order.mismatch_count AS "paymentOrder",
          payment_webhook.pending AS "paymentWebhookPending",
          payment_webhook.processing AS "paymentWebhookProcessing",
          payment_webhook.failed AS "paymentWebhookFailed",
          payment_webhook.oldest_seconds AS "paymentWebhookOldestSeconds"
        FROM ledger_balance, wallet_balance, chapter_purchase, payment_order, payment_webhook
      `);
      const row = rows[0];
      if (!row) throw new Error('Financial integrity query returned no row');
      this.metrics.setMonetizationFinancialIntegrity({
        ledger_balance: Number(row.ledgerBalance),
        wallet_balance: Number(row.walletBalance),
        chapter_purchase: Number(row.chapterPurchase),
        payment_order: Number(row.paymentOrder),
      });
      this.metrics.setPaymentWebhookBacklog({
        pending: Number(row.paymentWebhookPending),
        processing: Number(row.paymentWebhookProcessing),
        failed: Number(row.paymentWebhookFailed),
        oldestPendingAgeSeconds: row.paymentWebhookOldestSeconds,
      });
    } catch (error: unknown) {
      this.metrics.setMonetizationIntegritySnapshotHealthy(false);
      this.logger.error({
        event: 'monetization.integrity.snapshot.failed',
        error: error instanceof Error ? error.name : 'unknown',
      });
    }
  }
}
