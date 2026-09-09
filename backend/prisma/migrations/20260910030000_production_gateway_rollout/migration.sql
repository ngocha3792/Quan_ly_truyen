ALTER TYPE "payment_provider_kind" ADD VALUE IF NOT EXISTS 'vnpay';
ALTER TABLE "payment_orders"
  ADD COLUMN "provider_config_snapshot" JSONB,
  ADD COLUMN "provider_credential_snapshot" TEXT,
  ADD COLUMN "story_id" UUID,
  ADD COLUMN "provider_transaction_id" VARCHAR(160),
  ADD COLUMN "provider_transaction_date" VARCHAR(14),
  ADD COLUMN "reconciled_at" TIMESTAMPTZ(3);

CREATE TABLE "story_payment_allowlists" (
  "story_id" UUID PRIMARY KEY REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "enabled_providers" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "is_enabled" BOOLEAN NOT NULL DEFAULT false,
  "enabled_by" UUID, "updated_at" TIMESTAMPTZ(3) NOT NULL
);

CREATE TABLE "billing_refunds" (
  "id" UUID PRIMARY KEY,
  "order_id" UUID NOT NULL REFERENCES "payment_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "actor_id" UUID NOT NULL,
  "idempotency_key" VARCHAR(200) NOT NULL UNIQUE,
  "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK ("status" IN ('PENDING','UNKNOWN','COMPLETED','FAILED')),
  "amount_minor" BIGINT NOT NULL CHECK ("amount_minor" > 0),
  "credit_amount" BIGINT NOT NULL CHECK ("credit_amount" > 0),
  "currency" VARCHAR(3) NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "provider_refund_id" VARCHAR(160), "response_code" VARCHAR(50),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMPTZ(3), "updated_at" TIMESTAMPTZ(3) NOT NULL
);
CREATE INDEX "billing_refunds_order_id_created_at_idx" ON "billing_refunds"("order_id", "created_at");
CREATE INDEX "billing_refunds_status_created_at_idx" ON "billing_refunds"("status", "created_at");
CREATE UNIQUE INDEX "billing_refunds_active_order_unique" ON "billing_refunds"("order_id") WHERE "status" <> 'FAILED';
