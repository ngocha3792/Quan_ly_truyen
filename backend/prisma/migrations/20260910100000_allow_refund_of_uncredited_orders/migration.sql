ALTER TABLE "payment_orders"
    DROP CONSTRAINT "payment_orders_status_shape_check";

ALTER TABLE "payment_orders"
    ADD CONSTRAINT "payment_orders_status_shape_check" CHECK (
        ("status" IN ('created', 'pending', 'awaiting_review')
            AND "settled_at" IS NULL AND "wallet_transaction_id" IS NULL)
        OR ("status" = 'paid'
            AND "settled_at" IS NOT NULL AND "wallet_transaction_id" IS NOT NULL)
        OR ("status" IN ('failed', 'expired')
            AND "settled_at" IS NULL AND "wallet_transaction_id" IS NULL)
        OR ("status" IN ('refunded', 'reversed')
            AND "settled_at" IS NOT NULL AND "wallet_transaction_id" IS NOT NULL)
        OR ("status" = 'refunded'
            AND "settled_at" IS NULL AND "wallet_transaction_id" IS NULL)
    );
