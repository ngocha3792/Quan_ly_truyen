ALTER TABLE "chapter_purchases"
    ADD COLUMN "refund_wallet_transaction_id" UUID,
    ADD COLUMN "refund_reason" VARCHAR(500),
    ADD COLUMN "refunded_by_id" UUID;

CREATE UNIQUE INDEX "chapter_purchases_refund_wallet_transaction_key"
    ON "chapter_purchases"("refund_wallet_transaction_id");
CREATE INDEX "chapter_purchases_status_created_idx"
    ON "chapter_purchases"("status", "created_at", "id");
CREATE INDEX "chapter_purchases_refunder_refunded_idx"
    ON "chapter_purchases"("refunded_by_id", "refunded_at");

ALTER TABLE "chapter_purchases"
    DROP CONSTRAINT "chapter_purchases_refund_shape_check";
ALTER TABLE "chapter_purchases"
    ADD CONSTRAINT "chapter_purchases_refund_shape_check" CHECK (
        (
            "status" = 'completed'
            AND "refunded_at" IS NULL
            AND "refund_wallet_transaction_id" IS NULL
            AND "refund_reason" IS NULL
            AND "refunded_by_id" IS NULL
        )
        OR (
            "status" = 'refunded'
            AND "refunded_at" IS NOT NULL
            AND "refund_wallet_transaction_id" IS NOT NULL
            AND length(btrim("refund_reason")) BETWEEN 10 AND 500
            AND "refunded_by_id" IS NOT NULL
        )
        OR (
            "status" = 'reversed'
            AND "refunded_at" IS NOT NULL
        )
    );

ALTER TABLE "chapter_purchases"
    ADD CONSTRAINT "chapter_purchases_refund_wallet_transaction_id_fkey"
    FOREIGN KEY ("refund_wallet_transaction_id")
    REFERENCES "wallet_ledger_transactions"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "chapter_purchases"
    ADD CONSTRAINT "chapter_purchases_refunded_by_id_fkey"
    FOREIGN KEY ("refunded_by_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
