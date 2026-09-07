CREATE TYPE "chapter_access_type" AS ENUM ('free', 'paid');
CREATE TYPE "chapter_purchase_status" AS ENUM ('completed', 'refunded', 'reversed');
CREATE TYPE "chapter_entitlement_status" AS ENUM ('active', 'revoked');

CREATE TABLE "monetization_price_bands" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "credit_price" BIGINT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "monetization_price_bands_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "monetization_price_bands_credit_price_check"
        CHECK ("credit_price" > 0 AND "credit_price" <= 9000000000000000),
    CONSTRAINT "monetization_price_bands_code_check"
        CHECK (length(btrim("code")) > 0),
    CONSTRAINT "monetization_price_bands_label_check"
        CHECK (length(btrim("label")) > 0)
);

CREATE UNIQUE INDEX "monetization_price_bands_code_key"
    ON "monetization_price_bands"("code");
CREATE INDEX "monetization_price_bands_active_sort_idx"
    ON "monetization_price_bands"("is_active", "sort_order");

CREATE TABLE "chapter_monetization" (
    "chapter_id" UUID NOT NULL,
    "access_type" "chapter_access_type" NOT NULL DEFAULT 'free',
    "price_band_id" UUID,
    "credit_price" BIGINT,
    "preview_content" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "chapter_monetization_pkey" PRIMARY KEY ("chapter_id"),
    CONSTRAINT "chapter_monetization_version_check" CHECK ("version" > 0),
    CONSTRAINT "chapter_monetization_access_shape_check" CHECK (
        ("access_type" = 'free' AND "price_band_id" IS NULL AND "credit_price" IS NULL AND "preview_content" IS NULL)
        OR
        ("access_type" = 'paid' AND "price_band_id" IS NOT NULL
            AND "credit_price" > 0 AND "credit_price" <= 9000000000000000
            AND "preview_content" IS NOT NULL
            AND length(btrim("preview_content")) > 0)
    )
);

CREATE INDEX "chapter_monetization_access_updated_idx"
    ON "chapter_monetization"("access_type", "updated_at");
CREATE INDEX "chapter_monetization_price_band_idx"
    ON "chapter_monetization"("price_band_id");

CREATE TABLE "chapter_pricing_versions" (
    "id" UUID NOT NULL,
    "chapter_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "access_type" "chapter_access_type" NOT NULL,
    "price_band_id" UUID,
    "credit_price" BIGINT,
    "preview_content" TEXT,
    "changed_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chapter_pricing_versions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chapter_pricing_versions_version_check" CHECK ("version" > 0),
    CONSTRAINT "chapter_pricing_versions_access_shape_check" CHECK (
        ("access_type" = 'free' AND "price_band_id" IS NULL AND "credit_price" IS NULL AND "preview_content" IS NULL)
        OR
        ("access_type" = 'paid' AND "price_band_id" IS NOT NULL
            AND "credit_price" > 0 AND "credit_price" <= 9000000000000000
            AND "preview_content" IS NOT NULL AND length(btrim("preview_content")) > 0)
    )
);

CREATE UNIQUE INDEX "chapter_pricing_versions_chapter_version_key"
    ON "chapter_pricing_versions"("chapter_id", "version");
CREATE INDEX "chapter_pricing_versions_actor_created_idx"
    ON "chapter_pricing_versions"("changed_by_id", "created_at");

CREATE TABLE "chapter_purchases" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "chapter_id" UUID NOT NULL,
    "price_band_id" UUID,
    "credit_price" BIGINT NOT NULL,
    "status" "chapter_purchase_status" NOT NULL DEFAULT 'completed',
    "wallet_transaction_id" UUID NOT NULL,
    "idempotency_key" VARCHAR(200) NOT NULL,
    "request_hash" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "refunded_at" TIMESTAMPTZ(3),
    CONSTRAINT "chapter_purchases_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chapter_purchases_credit_price_check"
        CHECK ("credit_price" > 0 AND "credit_price" <= 9000000000000000),
    CONSTRAINT "chapter_purchases_idempotency_key_check"
        CHECK (length(btrim("idempotency_key")) BETWEEN 8 AND 200),
    CONSTRAINT "chapter_purchases_request_hash_check"
        CHECK ("request_hash" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "chapter_purchases_refund_shape_check" CHECK (
        ("status" = 'completed' AND "refunded_at" IS NULL)
        OR ("status" IN ('refunded', 'reversed') AND "refunded_at" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "chapter_purchases_wallet_transaction_key"
    ON "chapter_purchases"("wallet_transaction_id");
CREATE UNIQUE INDEX "chapter_purchases_idempotency_key_key"
    ON "chapter_purchases"("idempotency_key");
CREATE INDEX "chapter_purchases_user_history_idx"
    ON "chapter_purchases"("user_id", "created_at", "id");
CREATE INDEX "chapter_purchases_chapter_created_idx"
    ON "chapter_purchases"("chapter_id", "created_at");

CREATE TABLE "chapter_entitlements" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "chapter_id" UUID NOT NULL,
    "purchase_id" UUID NOT NULL,
    "status" "chapter_entitlement_status" NOT NULL DEFAULT 'active',
    "granted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(3),
    CONSTRAINT "chapter_entitlements_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chapter_entitlements_status_shape_check" CHECK (
        ("status" = 'active' AND "revoked_at" IS NULL)
        OR ("status" = 'revoked' AND "revoked_at" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "chapter_entitlements_purchase_key"
    ON "chapter_entitlements"("purchase_id");
CREATE UNIQUE INDEX "chapter_entitlements_user_chapter_key"
    ON "chapter_entitlements"("user_id", "chapter_id");
CREATE INDEX "chapter_entitlements_chapter_status_idx"
    ON "chapter_entitlements"("chapter_id", "status");

ALTER TABLE "chapter_monetization"
    ADD CONSTRAINT "chapter_monetization_chapter_id_fkey"
    FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chapter_monetization"
    ADD CONSTRAINT "chapter_monetization_price_band_id_fkey"
    FOREIGN KEY ("price_band_id") REFERENCES "monetization_price_bands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "chapter_monetization"
    ADD CONSTRAINT "chapter_monetization_updated_by_id_fkey"
    FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "chapter_pricing_versions"
    ADD CONSTRAINT "chapter_pricing_versions_chapter_id_fkey"
    FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chapter_pricing_versions"
    ADD CONSTRAINT "chapter_pricing_versions_price_band_id_fkey"
    FOREIGN KEY ("price_band_id") REFERENCES "monetization_price_bands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "chapter_pricing_versions"
    ADD CONSTRAINT "chapter_pricing_versions_changed_by_id_fkey"
    FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "chapter_purchases"
    ADD CONSTRAINT "chapter_purchases_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "chapter_purchases"
    ADD CONSTRAINT "chapter_purchases_chapter_id_fkey"
    FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "chapter_purchases"
    ADD CONSTRAINT "chapter_purchases_price_band_id_fkey"
    FOREIGN KEY ("price_band_id") REFERENCES "monetization_price_bands"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "chapter_purchases"
    ADD CONSTRAINT "chapter_purchases_wallet_transaction_id_fkey"
    FOREIGN KEY ("wallet_transaction_id") REFERENCES "wallet_ledger_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "chapter_entitlements"
    ADD CONSTRAINT "chapter_entitlements_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "chapter_entitlements"
    ADD CONSTRAINT "chapter_entitlements_chapter_id_fkey"
    FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "chapter_entitlements"
    ADD CONSTRAINT "chapter_entitlements_purchase_id_fkey"
    FOREIGN KEY ("purchase_id") REFERENCES "chapter_purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION reject_chapter_pricing_version_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'chapter pricing versions are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "chapter_pricing_versions_immutable"
BEFORE UPDATE OR DELETE ON "chapter_pricing_versions"
FOR EACH ROW EXECUTE FUNCTION reject_chapter_pricing_version_mutation();

INSERT INTO "monetization_price_bands"
    ("id", "code", "label", "credit_price", "is_active", "sort_order", "created_at", "updated_at")
VALUES
    ('10000000-0000-4000-8000-000000000010', 'BASIC', 'Cơ bản', 10, true, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('10000000-0000-4000-8000-000000000025', 'STANDARD', 'Tiêu chuẩn', 25, true, 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('10000000-0000-4000-8000-000000000050', 'PREMIUM', 'Cao cấp', 50, true, 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "chapter_monetization"
    ("chapter_id", "access_type", "version", "created_at", "updated_at")
SELECT "id", 'free', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "chapters"
ON CONFLICT ("chapter_id") DO NOTHING;

INSERT INTO "permissions" ("id", "code", "name", "resource", "action", "created_at", "updated_at")
VALUES
    (gen_random_uuid(), 'purchase.read.self', 'Read own chapter purchases', 'purchase', 'read.self', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'purchase.create.self', 'Purchase chapter access for self', 'purchase', 'create.self', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'chapter.monetization.manage.own', 'Manage monetization for own chapters', 'chapter.monetization', 'manage.own', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'monetization.price-band.manage', 'Manage monetization price bands', 'monetization.price-band', 'manage', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id", "granted_at")
SELECT role."id", permission."id", CURRENT_TIMESTAMP
FROM "roles" AS role
CROSS JOIN "permissions" AS permission
WHERE role."code" IN ('USER', 'AUTHOR', 'ADMIN')
  AND permission."code" IN ('purchase.read.self', 'purchase.create.self')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id", "granted_at")
SELECT role."id", permission."id", CURRENT_TIMESTAMP
FROM "roles" AS role
CROSS JOIN "permissions" AS permission
WHERE (role."code" = 'AUTHOR' AND permission."code" = 'chapter.monetization.manage.own')
   OR (role."code" = 'ADMIN' AND permission."code" IN (
       'chapter.monetization.manage.own', 'monetization.price-band.manage'
   ))
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
