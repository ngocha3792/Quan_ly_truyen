CREATE TYPE "payment_provider_kind" AS ENUM ('manual_bank_transfer', 'hmac_sandbox');

CREATE TABLE "payment_provider_connections" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "kind" "payment_provider_kind" NOT NULL,
    "display_name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500),
    "config" JSONB NOT NULL,
    "encrypted_credential" TEXT,
    "currency" VARCHAR(3) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "order_ttl_minutes" INTEGER,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "payment_provider_connections_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payment_provider_connections_code_check" CHECK (length(btrim("code")) > 0),
    CONSTRAINT "payment_provider_connections_name_check" CHECK (length(btrim("display_name")) > 0),
    CONSTRAINT "payment_provider_connections_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
    CONSTRAINT "payment_provider_connections_ttl_check" CHECK ("order_ttl_minutes" IS NULL OR "order_ttl_minutes" BETWEEN 5 AND 10080)
);

CREATE UNIQUE INDEX "payment_provider_connections_code_key" ON "payment_provider_connections"("code");
CREATE INDEX "payment_provider_connections_enabled_sort_idx" ON "payment_provider_connections"("enabled", "sort_order");
CREATE INDEX "payment_provider_connections_kind_idx" ON "payment_provider_connections"("kind");

ALTER TABLE "payment_orders"
    ADD COLUMN "provider_connection_id" UUID,
    ADD COLUMN "metadata" JSONB,
    ADD COLUMN "review_requested_at" TIMESTAMPTZ(3),
    ADD COLUMN "reviewed_at" TIMESTAMPTZ(3),
    ADD COLUMN "reviewed_by_id" UUID,
    ADD COLUMN "review_reason" VARCHAR(500);

CREATE INDEX "payment_orders_provider_connection_id_idx" ON "payment_orders"("provider_connection_id");
CREATE INDEX "payment_orders_status_review_requested_idx" ON "payment_orders"("status", "review_requested_at");

ALTER TABLE "payment_orders"
    ADD CONSTRAINT "payment_orders_provider_connection_id_fkey"
    FOREIGN KEY ("provider_connection_id") REFERENCES "payment_provider_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payment_orders" DROP CONSTRAINT "payment_orders_status_shape_check";
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_status_shape_check" CHECK (
    ("status" IN ('created', 'pending', 'awaiting_review') AND "settled_at" IS NULL AND "wallet_transaction_id" IS NULL)
    OR ("status" = 'paid' AND "settled_at" IS NOT NULL AND "wallet_transaction_id" IS NOT NULL)
    OR ("status" IN ('failed', 'expired') AND "settled_at" IS NULL AND "wallet_transaction_id" IS NULL)
    OR ("status" IN ('refunded', 'reversed') AND "settled_at" IS NOT NULL AND "wallet_transaction_id" IS NOT NULL)
);

INSERT INTO "payment_provider_connections"
    ("id", "code", "kind", "display_name", "description", "config", "currency", "enabled", "sort_order", "order_ttl_minutes", "created_at", "updated_at")
VALUES
    ('30000000-0000-4000-8000-000000000001', 'hmac-sandbox', 'hmac_sandbox', 'HMAC Sandbox', 'Nhà cung cấp giả lập dùng cho môi trường kiểm thử', '{}'::jsonb, 'VND', false, 100, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('30000000-0000-4000-8000-000000000002', 'manual-bank-transfer', 'manual_bank_transfer', 'Chuyển khoản ngân hàng', 'Chuyển khoản và chờ quản trị viên xác nhận', '{"bankName":"","accountNumber":"","accountHolder":"","branch":"","transferNoteTemplate":"NAP {{reference}}","instructionNote":""}'::jsonb, 'VND', false, 10, 2880, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

UPDATE "payment_orders" AS orders
SET "provider_connection_id" = connections."id"
FROM "payment_provider_connections" AS connections
WHERE orders."provider" = connections."code"
  AND orders."provider_connection_id" IS NULL;

INSERT INTO "permissions" ("id", "code", "name", "resource", "action", "created_at", "updated_at")
VALUES
    (gen_random_uuid(), 'payment.order.settle.admin', 'Settle manual payment orders', 'payment.order', 'settle.admin', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'payment.provider.manage.admin', 'Manage payment provider connections', 'payment.provider', 'manage.admin', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id", "granted_at")
SELECT role."id", permission."id", CURRENT_TIMESTAMP
FROM "roles" AS role
CROSS JOIN "permissions" AS permission
WHERE role."code" = 'ADMIN'
  AND permission."code" IN ('payment.order.settle.admin', 'payment.provider.manage.admin')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
