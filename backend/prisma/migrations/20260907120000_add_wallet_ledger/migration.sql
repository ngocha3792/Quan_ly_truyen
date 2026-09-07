CREATE TYPE "wallet_currency" AS ENUM ('credit');
CREATE TYPE "wallet_transaction_type" AS ENUM (
  'top_up',
  'chapter_purchase',
  'refund',
  'reversal',
  'admin_adjustment'
);
CREATE TYPE "wallet_system_account" AS ENUM (
  'payment_clearing',
  'platform_revenue',
  'adjustment'
);

CREATE TABLE "wallets" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "currency" "wallet_currency" NOT NULL DEFAULT 'credit',
  "balance" BIGINT NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "wallets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "wallets_balance_non_negative" CHECK ("balance" >= 0),
  CONSTRAINT "wallets_balance_within_limit" CHECK ("balance" <= 9000000000000000),
  CONSTRAINT "wallets_version_non_negative" CHECK ("version" >= 0)
);

CREATE TABLE "wallet_ledger_transactions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "wallet_id" UUID NOT NULL,
  "currency" "wallet_currency" NOT NULL,
  "type" "wallet_transaction_type" NOT NULL,
  "idempotency_key" VARCHAR(200) NOT NULL,
  "request_hash" VARCHAR(64) NOT NULL,
  "reference_type" VARCHAR(100) NOT NULL,
  "reference_id" VARCHAR(100) NOT NULL,
  "wallet_amount" BIGINT NOT NULL,
  "wallet_balance_after" BIGINT NOT NULL,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "wallet_ledger_transactions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "wallet_ledger_transactions_wallet_amount_non_zero" CHECK ("wallet_amount" <> 0),
  CONSTRAINT "wallet_ledger_transactions_wallet_amount_within_limit" CHECK (
    "wallet_amount" BETWEEN -9000000000000000 AND 9000000000000000
  ),
  CONSTRAINT "wallet_ledger_transactions_balance_non_negative" CHECK ("wallet_balance_after" >= 0),
  CONSTRAINT "wallet_ledger_transactions_balance_within_limit" CHECK (
    "wallet_balance_after" <= 9000000000000000
  ),
  CONSTRAINT "wallet_ledger_transactions_request_hash_format" CHECK ("request_hash" ~ '^[0-9a-f]{64}$')
);

CREATE TABLE "wallet_ledger_entries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "transaction_id" UUID NOT NULL,
  "wallet_id" UUID,
  "system_account" "wallet_system_account",
  "currency" "wallet_currency" NOT NULL,
  "amount" BIGINT NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "wallet_ledger_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "wallet_ledger_entries_amount_non_zero" CHECK ("amount" <> 0),
  CONSTRAINT "wallet_ledger_entries_amount_within_limit" CHECK (
    "amount" BETWEEN -9000000000000000 AND 9000000000000000
  ),
  CONSTRAINT "wallet_ledger_entries_exactly_one_account" CHECK (
    (("wallet_id" IS NOT NULL)::integer + ("system_account" IS NOT NULL)::integer) = 1
  )
);

CREATE UNIQUE INDEX "wallets_user_currency_unique"
  ON "wallets"("user_id", "currency");
CREATE INDEX "wallets_user_id_updated_at_idx"
  ON "wallets"("user_id", "updated_at");
CREATE UNIQUE INDEX "wallet_ledger_transactions_idempotency_key_unique"
  ON "wallet_ledger_transactions"("idempotency_key");
CREATE UNIQUE INDEX "wallet_ledger_transactions_business_reference_unique"
  ON "wallet_ledger_transactions"("wallet_id", "type", "reference_type", "reference_id");
CREATE INDEX "wallet_ledger_transactions_wallet_history_idx"
  ON "wallet_ledger_transactions"("wallet_id", "created_at", "id");
CREATE UNIQUE INDEX "wallet_ledger_entries_transaction_wallet_unique"
  ON "wallet_ledger_entries"("transaction_id", "wallet_id");
CREATE UNIQUE INDEX "wallet_ledger_entries_transaction_system_unique"
  ON "wallet_ledger_entries"("transaction_id", "system_account");
CREATE INDEX "wallet_ledger_entries_wallet_history_idx"
  ON "wallet_ledger_entries"("wallet_id", "created_at", "id");

ALTER TABLE "wallets"
  ADD CONSTRAINT "wallets_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "wallet_ledger_transactions"
  ADD CONSTRAINT "wallet_ledger_transactions_wallet_id_fkey"
  FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "wallet_ledger_entries"
  ADD CONSTRAINT "wallet_ledger_entries_transaction_id_fkey"
  FOREIGN KEY ("transaction_id") REFERENCES "wallet_ledger_transactions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "wallet_ledger_entries"
  ADD CONSTRAINT "wallet_ledger_entries_wallet_id_fkey"
  FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "assert_wallet_ledger_transaction_balanced"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_transaction_id UUID;
  ledger_transaction "wallet_ledger_transactions"%ROWTYPE;
  entry_count INTEGER;
  wallet_entry_count INTEGER;
  system_entry_count INTEGER;
  entry_sum BIGINT;
  wallet_entry_amount BIGINT;
  system_entry_amount BIGINT;
  invalid_currency_count INTEGER;
BEGIN
  target_transaction_id := COALESCE(NEW."transaction_id", OLD."transaction_id");

  SELECT * INTO ledger_transaction
  FROM "wallet_ledger_transactions"
  WHERE "id" = target_transaction_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE "wallet_id" = ledger_transaction."wallet_id"),
    COUNT(*) FILTER (WHERE "system_account" IS NOT NULL),
    COALESCE(SUM("amount"), 0),
    COALESCE(SUM("amount") FILTER (WHERE "wallet_id" = ledger_transaction."wallet_id"), 0),
    COALESCE(SUM("amount") FILTER (WHERE "system_account" IS NOT NULL), 0),
    COUNT(*) FILTER (WHERE "currency" <> ledger_transaction."currency")
  INTO
    entry_count,
    wallet_entry_count,
    system_entry_count,
    entry_sum,
    wallet_entry_amount,
    system_entry_amount,
    invalid_currency_count
  FROM "wallet_ledger_entries"
  WHERE "transaction_id" = target_transaction_id;

  IF entry_count <> 2
    OR wallet_entry_count <> 1
    OR system_entry_count <> 1
    OR entry_sum <> 0
    OR wallet_entry_amount <> ledger_transaction."wallet_amount"
    OR system_entry_amount <> -ledger_transaction."wallet_amount"
    OR invalid_currency_count <> 0
  THEN
    RAISE EXCEPTION 'Unbalanced wallet ledger transaction %', target_transaction_id
      USING ERRCODE = '23514';
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "wallet_ledger_transaction_balanced"
AFTER INSERT OR UPDATE OR DELETE ON "wallet_ledger_entries"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "assert_wallet_ledger_transaction_balanced"();

CREATE FUNCTION "prevent_wallet_ledger_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Wallet ledger records are immutable'
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER "wallet_ledger_transactions_immutable"
BEFORE UPDATE OR DELETE ON "wallet_ledger_transactions"
FOR EACH ROW
EXECUTE FUNCTION "prevent_wallet_ledger_mutation"();

CREATE TRIGGER "wallet_ledger_entries_immutable"
BEFORE UPDATE OR DELETE ON "wallet_ledger_entries"
FOR EACH ROW
EXECUTE FUNCTION "prevent_wallet_ledger_mutation"();

INSERT INTO "permissions" (
  "id", "code", "name", "resource", "action", "created_at", "updated_at"
)
VALUES (
  gen_random_uuid(),
  'wallet.read.self',
  'Read own wallet and transaction history',
  'wallet',
  'read.self',
  NOW(),
  NOW()
)
ON CONFLICT ("code") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "resource" = EXCLUDED."resource",
  "action" = EXCLUDED."action",
  "updated_at" = NOW();

INSERT INTO "role_permissions" ("role_id", "permission_id", "granted_at")
SELECT role_row."id", permission_row."id", NOW()
FROM "roles" AS role_row
JOIN "permissions" AS permission_row
  ON permission_row."code" = 'wallet.read.self'
WHERE role_row."code" IN ('USER', 'AUTHOR', 'ADMIN')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
