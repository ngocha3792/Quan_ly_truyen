CREATE TYPE "payment_order_status" AS ENUM (
    'created', 'pending', 'paid', 'failed', 'expired', 'refunded', 'reversed'
);

CREATE TABLE "credit_packages" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "credit_amount" BIGINT NOT NULL,
    "fiat_amount_minor" BIGINT NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "credit_packages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "credit_packages_amounts_positive_check"
        CHECK ("credit_amount" > 0 AND "credit_amount" <= 9000000000000000
            AND "fiat_amount_minor" > 0 AND "fiat_amount_minor" <= 9000000000000000),
    CONSTRAINT "credit_packages_code_check" CHECK (length(btrim("code")) > 0),
    CONSTRAINT "credit_packages_label_check" CHECK (length(btrim("label")) > 0),
    CONSTRAINT "credit_packages_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$')
);

CREATE UNIQUE INDEX "credit_packages_code_key" ON "credit_packages"("code");
CREATE INDEX "credit_packages_active_sort_idx" ON "credit_packages"("is_active", "sort_order");

CREATE TABLE "payment_orders" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "package_id" UUID NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "provider_reference" VARCHAR(160),
    "credit_amount" BIGINT NOT NULL,
    "fiat_amount_minor" BIGINT NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "status" "payment_order_status" NOT NULL DEFAULT 'created',
    "checkout_url" TEXT,
    "idempotency_key" VARCHAR(200) NOT NULL,
    "request_hash" VARCHAR(64) NOT NULL,
    "wallet_transaction_id" UUID,
    "failure_code" VARCHAR(120),
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "settled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "payment_orders_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payment_orders_amounts_positive_check"
        CHECK ("credit_amount" > 0 AND "credit_amount" <= 9000000000000000
            AND "fiat_amount_minor" > 0 AND "fiat_amount_minor" <= 9000000000000000),
    CONSTRAINT "payment_orders_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
    CONSTRAINT "payment_orders_provider_check" CHECK (length(btrim("provider")) > 0),
    CONSTRAINT "payment_orders_idempotency_key_check"
        CHECK (length(btrim("idempotency_key")) BETWEEN 8 AND 200),
    CONSTRAINT "payment_orders_request_hash_check" CHECK ("request_hash" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "payment_orders_expiry_check" CHECK ("expires_at" > "created_at"),
    CONSTRAINT "payment_orders_status_shape_check" CHECK (
        ("status" IN ('created', 'pending') AND "settled_at" IS NULL AND "wallet_transaction_id" IS NULL)
        OR ("status" = 'paid' AND "settled_at" IS NOT NULL AND "wallet_transaction_id" IS NOT NULL)
        OR ("status" IN ('failed', 'expired') AND "settled_at" IS NULL AND "wallet_transaction_id" IS NULL)
        OR ("status" IN ('refunded', 'reversed') AND "settled_at" IS NOT NULL AND "wallet_transaction_id" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "payment_orders_idempotency_key_key" ON "payment_orders"("idempotency_key");
CREATE UNIQUE INDEX "payment_orders_wallet_transaction_id_key" ON "payment_orders"("wallet_transaction_id");
CREATE UNIQUE INDEX "payment_orders_provider_reference_unique"
    ON "payment_orders"("provider", "provider_reference");
CREATE INDEX "payment_orders_user_created_idx" ON "payment_orders"("user_id", "created_at", "id");
CREATE INDEX "payment_orders_status_expiry_idx" ON "payment_orders"("status", "expires_at");
CREATE INDEX "payment_orders_provider_status_updated_idx"
    ON "payment_orders"("provider", "status", "updated_at");

ALTER TABLE "payment_orders"
    ADD CONSTRAINT "payment_orders_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_orders"
    ADD CONSTRAINT "payment_orders_package_id_fkey"
    FOREIGN KEY ("package_id") REFERENCES "credit_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_orders"
    ADD CONSTRAINT "payment_orders_wallet_transaction_id_fkey"
    FOREIGN KEY ("wallet_transaction_id") REFERENCES "wallet_ledger_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "credit_packages"
    ("id", "code", "label", "credit_amount", "fiat_amount_minor", "currency", "is_active", "sort_order", "created_at", "updated_at")
VALUES
    ('20000000-0000-4000-8000-000000000100', 'STARTER', 'Gói khởi đầu', 100, 10000, 'VND', false, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('20000000-0000-4000-8000-000000000550', 'POPULAR', 'Gói phổ biến', 550, 50000, 'VND', false, 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('20000000-0000-4000-8000-000000001200', 'VALUE', 'Gói tiết kiệm', 1200, 100000, 'VND', false, 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "permissions" ("id", "code", "name", "resource", "action", "created_at", "updated_at")
VALUES
    (gen_random_uuid(), 'payment.order.create.self', 'Create own payment order', 'payment.order', 'create.self', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'payment.order.read.self', 'Read own payment orders', 'payment.order', 'read.self', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'payment.read.admin', 'Read payment operations', 'payment', 'read.admin', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'payment.package.manage.admin', 'Manage credit packages', 'payment.package', 'manage.admin', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'payment.reconcile.admin', 'Reconcile payments', 'payment', 'reconcile.admin', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'payment.refund.admin', 'Refund payments', 'payment', 'refund.admin', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'wallet.adjust.admin', 'Adjust wallets', 'wallet', 'adjust.admin', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id", "granted_at")
SELECT role."id", permission."id", CURRENT_TIMESTAMP
FROM "roles" AS role
CROSS JOIN "permissions" AS permission
WHERE role."code" IN ('USER', 'AUTHOR', 'ADMIN')
  AND permission."code" IN ('payment.order.create.self', 'payment.order.read.self')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id", "granted_at")
SELECT role."id", permission."id", CURRENT_TIMESTAMP
FROM "roles" AS role
CROSS JOIN "permissions" AS permission
WHERE role."code" = 'ADMIN'
  AND permission."code" IN (
      'payment.read.admin', 'payment.package.manage.admin', 'payment.reconcile.admin',
      'payment.refund.admin', 'wallet.adjust.admin'
  )
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
