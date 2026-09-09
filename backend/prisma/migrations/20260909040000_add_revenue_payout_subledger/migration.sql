CREATE TYPE "revenue_share_type" AS ENUM ('AUTHOR_SHARE', 'PLATFORM_FEE', 'CONTRIBUTOR');
CREATE TYPE "allocation_status" AS ENUM ('PENDING', 'SETTLED', 'REFUNDED');
CREATE TYPE "earning_status" AS ENUM ('PENDING', 'AVAILABLE', 'RESERVED', 'PAID', 'FAILED');
CREATE TYPE "payout_status" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE "payout_method" AS ENUM ('BANK_TRANSFER', 'MOMO', 'ZALOPAY');

CREATE TABLE "revenue_share_agreements" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "story_id" uuid NOT NULL, "version" integer NOT NULL DEFAULT 1,
 "author_user_id" uuid NOT NULL, "author_share" decimal(5,4) NOT NULL, "platform_fee" decimal(5,4) NOT NULL,
 "contributor_shares" jsonb, "effective_from" timestamptz(3) NOT NULL, "effective_to" timestamptz(3),
 "created_by" uuid NOT NULL, "approved_by" uuid, "approved_at" timestamptz(3), "created_at" timestamptz(3) NOT NULL DEFAULT now(),
 CONSTRAINT revenue_share_agreements_share_check CHECK (author_share >= 0 AND platform_fee >= 0 AND author_share + platform_fee <= 1 AND author_share + platform_fee > 0),
 CONSTRAINT revenue_share_agreements_story_version_key UNIQUE(story_id, version),
 CONSTRAINT revenue_share_agreements_story_fk FOREIGN KEY(story_id) REFERENCES stories(id) ON DELETE CASCADE,
 CONSTRAINT revenue_share_agreements_author_fk FOREIGN KEY(author_user_id) REFERENCES users(id) ON DELETE RESTRICT,
 CONSTRAINT revenue_share_agreements_creator_fk FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE RESTRICT
);
CREATE INDEX revenue_share_agreements_story_effective_idx ON revenue_share_agreements(story_id, effective_from, effective_to);

CREATE TABLE "revenue_allocations" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "purchase_id" uuid NOT NULL, "agreement_id" uuid NOT NULL,
 "recipient_user_id" uuid NOT NULL, "allocation_type" revenue_share_type NOT NULL, "gross_amount" bigint NOT NULL,
 "share_basis_points" integer NOT NULL, "net_amount" bigint NOT NULL, "status" allocation_status NOT NULL DEFAULT 'PENDING',
 "settled_at" timestamptz(3), "is_refund" boolean NOT NULL DEFAULT false, "refunds_allocation_id" uuid UNIQUE,
 "refunded_by" uuid, "created_at" timestamptz(3) NOT NULL DEFAULT now(),
 CONSTRAINT revenue_allocations_amount_check CHECK(gross_amount >= 0 AND net_amount >= 0 AND share_basis_points >= 0 AND share_basis_points <= 10000),
 CONSTRAINT revenue_allocations_purchase_fk FOREIGN KEY(purchase_id) REFERENCES chapter_purchases(id) ON DELETE RESTRICT,
 CONSTRAINT revenue_allocations_agreement_fk FOREIGN KEY(agreement_id) REFERENCES revenue_share_agreements(id) ON DELETE RESTRICT,
 CONSTRAINT revenue_allocations_recipient_fk FOREIGN KEY(recipient_user_id) REFERENCES users(id) ON DELETE RESTRICT
);
CREATE INDEX revenue_allocations_recipient_status_idx ON revenue_allocations(recipient_user_id, status, settled_at);
CREATE INDEX revenue_allocations_purchase_idx ON revenue_allocations(purchase_id);

CREATE TABLE "author_earning_ledger" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "allocation_id" uuid UNIQUE NOT NULL,
 "amount" bigint NOT NULL, "status" earning_status NOT NULL DEFAULT 'PENDING', "settlement_date" timestamptz(3) NOT NULL,
 "available_at" timestamptz(3), "payout_request_id" uuid, "reserved_at" timestamptz(3), "paid_at" timestamptz(3), "created_at" timestamptz(3) NOT NULL DEFAULT now(),
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE RESTRICT,
 FOREIGN KEY(allocation_id) REFERENCES revenue_allocations(id) ON DELETE RESTRICT
);
CREATE INDEX author_earning_ledger_user_status_idx ON author_earning_ledger(user_id, status, available_at);

CREATE TABLE "payout_accounts" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "method" payout_method NOT NULL,
 "bank_name" varchar(255), "account_number" varchar(80), "account_name" varchar(255), "wallet_phone" varchar(20),
 "is_verified" boolean NOT NULL DEFAULT false, "is_active" boolean NOT NULL DEFAULT true, "is_primary" boolean NOT NULL DEFAULT false,
 "created_at" timestamptz(3) NOT NULL DEFAULT now(), "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX payout_accounts_user_active_idx ON payout_accounts(user_id, is_active);

CREATE TABLE "payout_batches" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "batch_number" varchar(80) UNIQUE NOT NULL, "total_requests" integer NOT NULL, "total_amount" bigint NOT NULL,
 "status" payout_status NOT NULL DEFAULT 'PENDING', "processed_by" uuid, "created_at" timestamptz(3) NOT NULL DEFAULT now()
);
CREATE TABLE "payout_requests" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "account_id" uuid NOT NULL, "gross_amount" bigint NOT NULL, "fee_amount" bigint NOT NULL, "tax_amount" bigint NOT NULL, "net_amount" bigint NOT NULL,
 "status" payout_status NOT NULL DEFAULT 'PENDING', "provider_txn_id" varchar(255), "failure_reason" text, "processed_at" timestamptz(3), "completed_at" timestamptz(3), "created_at" timestamptz(3) NOT NULL DEFAULT now(), "batch_id" uuid,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE RESTRICT, FOREIGN KEY(account_id) REFERENCES payout_accounts(id) ON DELETE RESTRICT, FOREIGN KEY(batch_id) REFERENCES payout_batches(id) ON DELETE RESTRICT,
 CONSTRAINT payout_requests_amount_check CHECK(gross_amount >= 0 AND fee_amount >= 0 AND tax_amount >= 0 AND net_amount = gross_amount - fee_amount - tax_amount)
);
ALTER TABLE author_earning_ledger ADD FOREIGN KEY(payout_request_id) REFERENCES payout_requests(id) ON DELETE RESTRICT;
CREATE INDEX payout_requests_user_status_idx ON payout_requests(user_id, status, created_at);
CREATE INDEX payout_requests_status_created_idx ON payout_requests(status, created_at);
