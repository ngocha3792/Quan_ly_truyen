BEGIN;

ALTER TABLE revenue_share_agreements ADD COLUMN platform_user_id uuid REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE revenue_share_agreements ADD COLUMN idempotency_key varchar(200) UNIQUE, ADD COLUMN request_hash varchar(64);
ALTER TABLE revenue_share_agreements ADD CONSTRAINT revenue_agreement_period_check
  CHECK (effective_to IS NULL OR effective_to > effective_from);

CREATE TABLE revenue_policies (
  id varchar(40) PRIMARY KEY DEFAULT 'default' CHECK (id = 'default'),
  enabled boolean NOT NULL DEFAULT false, version integer NOT NULL DEFAULT 1,
  settlement_delay_days integer NOT NULL DEFAULT 7,
  minimum_payout_credits bigint NOT NULL DEFAULT 100,
  fee_basis_points integer NOT NULL DEFAULT 0, tax_basis_points integer NOT NULL DEFAULT 0,
  minimum_platform_fee_basis_points integer NOT NULL DEFAULT 1000,
  fiat_minor_per_credit bigint NOT NULL DEFAULT 0, currency varchar(3) NOT NULL DEFAULT 'VND',
  platform_user_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  updated_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  updated_at timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT revenue_policy_valid CHECK (
    version > 0 AND settlement_delay_days BETWEEN 0 AND 365
    AND minimum_payout_credits BETWEEN 1 AND 9000000000000000
    AND fee_basis_points BETWEEN 0 AND 9999 AND tax_basis_points BETWEEN 0 AND 9999
    AND fee_basis_points + tax_basis_points < 10000
    AND minimum_platform_fee_basis_points BETWEEN 0 AND 10000
    AND fiat_minor_per_credit BETWEEN 0 AND 1000000 AND currency = 'VND'
    AND (NOT enabled OR (platform_user_id IS NOT NULL AND fiat_minor_per_credit > 0))
  )
);
INSERT INTO revenue_policies(id) VALUES ('default');

ALTER TABLE payout_accounts
  ADD COLUMN kyc_reference varchar(500), ADD COLUMN verification_reason varchar(500),
  ADD COLUMN verified_at timestamptz(3), ADD COLUMN verified_by uuid REFERENCES users(id) ON DELETE RESTRICT;
-- Existing approvals require an audited review under the new KYC workflow.
UPDATE payout_accounts SET is_verified = false WHERE is_verified;
ALTER TABLE payout_accounts ADD CONSTRAINT payout_account_verification_check CHECK (
  NOT is_verified OR (verified_at IS NOT NULL AND verified_by IS NOT NULL
    AND length(btrim(kyc_reference)) > 0 AND length(btrim(verification_reason)) > 0)
);
CREATE UNIQUE INDEX payout_accounts_primary_user_unique ON payout_accounts(user_id) WHERE is_primary AND is_active;

ALTER TABLE payout_requests
  ADD COLUMN idempotency_key varchar(200) UNIQUE, ADD COLUMN request_hash varchar(64),
  ADD COLUMN policy_snapshot jsonb, ADD COLUMN account_snapshot jsonb,
  ADD COLUMN fiat_amount_minor bigint, ADD COLUMN currency varchar(3),
  ADD COLUMN failed_at timestamptz(3), ADD COLUMN cancelled_at timestamptz(3);
ALTER TABLE payout_requests ADD CONSTRAINT payout_request_snapshot_check CHECK (
  idempotency_key IS NULL OR (length(idempotency_key) BETWEEN 8 AND 200
    AND request_hash ~ '^[0-9a-f]{64}$' AND policy_snapshot IS NOT NULL AND account_snapshot IS NOT NULL
    AND gross_amount > 0 AND net_amount > 0 AND fiat_amount_minor > 0 AND currency = 'VND')
);
ALTER TABLE payout_requests ADD CONSTRAINT payout_request_transition_shape CHECK (
  idempotency_key IS NULL OR
  (status = 'PENDING' AND completed_at IS NULL AND failed_at IS NULL AND cancelled_at IS NULL)
  OR (status = 'PROCESSING' AND batch_id IS NOT NULL AND processed_at IS NOT NULL AND completed_at IS NULL AND failed_at IS NULL AND cancelled_at IS NULL)
  OR (status = 'COMPLETED' AND processed_at IS NOT NULL AND completed_at IS NOT NULL AND provider_txn_id IS NOT NULL AND length(btrim(provider_txn_id)) > 0)
  OR (status = 'FAILED' AND failed_at IS NOT NULL AND length(btrim(failure_reason)) > 0)
  OR (status = 'CANCELLED' AND cancelled_at IS NOT NULL)
);
CREATE UNIQUE INDEX payout_requests_transfer_reference_unique ON payout_requests(provider_txn_id) WHERE provider_txn_id IS NOT NULL;
ALTER TABLE payout_batches ADD COLUMN idempotency_key varchar(200) UNIQUE, ADD COLUMN completed_at timestamptz(3);

CREATE TABLE payout_earning_reservations (
  request_id uuid NOT NULL REFERENCES payout_requests(id) ON DELETE RESTRICT,
  earning_id uuid NOT NULL REFERENCES author_earning_ledger(id) ON DELETE RESTRICT,
  amount bigint NOT NULL CHECK (amount > 0), PRIMARY KEY(request_id, earning_id)
);
CREATE INDEX payout_earning_reservations_earning_id_idx ON payout_earning_reservations(earning_id);

ALTER TABLE revenue_allocations DROP CONSTRAINT revenue_allocations_amount_check;
ALTER TABLE revenue_allocations ADD CONSTRAINT revenue_allocations_amount_check CHECK (
  gross_amount > 0 AND share_basis_points BETWEEN 0 AND 10000
  AND ((NOT is_refund AND net_amount >= 0 AND refunds_allocation_id IS NULL)
    OR (is_refund AND net_amount <= 0 AND refunds_allocation_id IS NOT NULL))
);
ALTER TABLE revenue_allocations ADD CONSTRAINT revenue_allocations_refund_fk
  FOREIGN KEY(refunds_allocation_id) REFERENCES revenue_allocations(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX revenue_allocations_purchase_recipient_unique
  ON revenue_allocations(purchase_id, allocation_type, recipient_user_id) WHERE NOT is_refund;

CREATE TABLE revenue_journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_key varchar(200) NOT NULL,
  account varchar(40) NOT NULL CHECK (account IN ('CLEARING','PAYABLE','PLATFORM','RESERVED','PAID','FEE','TAX')),
  user_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  amount bigint NOT NULL CHECK (amount <> 0), created_at timestamptz(3) NOT NULL DEFAULT now()
);
CREATE INDEX revenue_journal_entries_event_key_idx ON revenue_journal_entries(event_key);
CREATE INDEX revenue_journal_entries_user_id_account_created_at_idx ON revenue_journal_entries(user_id,account,created_at);

CREATE FUNCTION revenue_enforce_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'financial records are immutable'; END IF;
  IF TG_TABLE_NAME IN ('revenue_journal_entries','payout_earning_reservations') THEN
    RAISE EXCEPTION 'financial postings are immutable';
  ELSIF TG_TABLE_NAME = 'revenue_allocations' THEN
    IF (to_jsonb(NEW) - ARRAY['status','settled_at','refunded_by']) IS DISTINCT FROM
      (to_jsonb(OLD) - ARRAY['status','settled_at','refunded_by']) THEN
      RAISE EXCEPTION 'allocation amounts and purchase snapshots are immutable';
    END IF;
  ELSIF TG_TABLE_NAME = 'author_earning_ledger' THEN
    IF ROW(NEW.id,NEW.user_id,NEW.allocation_id,NEW.amount,NEW.settlement_date,NEW.created_at)
      IS DISTINCT FROM ROW(OLD.id,OLD.user_id,OLD.allocation_id,OLD.amount,OLD.settlement_date,OLD.created_at) THEN
      RAISE EXCEPTION 'earning amounts and source are immutable';
    END IF;
  ELSIF TG_TABLE_NAME = 'payout_requests' THEN
    IF (to_jsonb(NEW) - ARRAY['status','batch_id','processed_at','completed_at','failed_at','cancelled_at','failure_reason','provider_txn_id'])
      IS DISTINCT FROM
      (to_jsonb(OLD) - ARRAY['status','batch_id','processed_at','completed_at','failed_at','cancelled_at','failure_reason','provider_txn_id']) THEN
      RAISE EXCEPTION 'payout amounts and policy snapshots are immutable';
    END IF;
  ELSIF TG_TABLE_NAME = 'revenue_share_agreements' THEN
    IF (to_jsonb(NEW) - 'effective_to') IS DISTINCT FROM (to_jsonb(OLD) - 'effective_to') THEN
      RAISE EXCEPTION 'revenue agreements must be versioned';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER revenue_allocations_immutable BEFORE UPDATE OR DELETE ON revenue_allocations FOR EACH ROW EXECUTE FUNCTION revenue_enforce_immutable();
CREATE TRIGGER author_earnings_immutable BEFORE UPDATE OR DELETE ON author_earning_ledger FOR EACH ROW EXECUTE FUNCTION revenue_enforce_immutable();
CREATE TRIGGER payout_requests_immutable BEFORE UPDATE OR DELETE ON payout_requests FOR EACH ROW EXECUTE FUNCTION revenue_enforce_immutable();
CREATE TRIGGER payout_reservations_immutable BEFORE UPDATE OR DELETE ON payout_earning_reservations FOR EACH ROW EXECUTE FUNCTION revenue_enforce_immutable();
CREATE TRIGGER revenue_journal_immutable BEFORE UPDATE OR DELETE ON revenue_journal_entries FOR EACH ROW EXECUTE FUNCTION revenue_enforce_immutable();
CREATE TRIGGER revenue_agreements_immutable BEFORE UPDATE OR DELETE ON revenue_share_agreements FOR EACH ROW EXECUTE FUNCTION revenue_enforce_immutable();

CREATE FUNCTION revenue_check_journal_balance() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT COALESCE(sum(amount),0) FROM revenue_journal_entries WHERE event_key = NEW.event_key) <> 0 THEN
    RAISE EXCEPTION 'unbalanced revenue journal %', NEW.event_key USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER revenue_journal_balanced AFTER INSERT ON revenue_journal_entries
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION revenue_check_journal_balance();

CREATE FUNCTION revenue_check_allocation_total() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE expected bigint; actual numeric; bps bigint;
BEGIN
  SELECT credit_price INTO expected FROM chapter_purchases WHERE id = NEW.purchase_id;
  SELECT sum(net_amount),sum(share_basis_points) INTO actual,bps FROM revenue_allocations
    WHERE purchase_id = NEW.purchase_id AND is_refund = NEW.is_refund;
  IF actual <> (CASE WHEN NEW.is_refund THEN -expected ELSE expected END) OR bps <> 10000 THEN
    RAISE EXCEPTION 'unbalanced revenue allocation for purchase %', NEW.purchase_id USING ERRCODE = '23514';
  END IF;
  IF NEW.is_refund AND NOT EXISTS (SELECT 1 FROM revenue_allocations original
    WHERE original.id = NEW.refunds_allocation_id AND NOT original.is_refund
    AND original.purchase_id = NEW.purchase_id AND original.recipient_user_id = NEW.recipient_user_id
    AND original.allocation_type = NEW.allocation_type AND original.net_amount = -NEW.net_amount
    AND original.agreement_id = NEW.agreement_id AND original.share_basis_points = NEW.share_basis_points) THEN
    RAISE EXCEPTION 'refund must compensate the original allocation' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER revenue_allocations_balanced AFTER INSERT ON revenue_allocations
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION revenue_check_allocation_total();

CREATE FUNCTION revenue_check_reservations() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE request_key uuid; invalid boolean;
BEGIN
  IF TG_TABLE_NAME = 'payout_requests' THEN request_key := NEW.id; ELSE request_key := NEW.request_id; END IF;
  SELECT (request.gross_amount <> COALESCE(sum(reservation.amount),0)) INTO invalid
    FROM payout_requests request LEFT JOIN payout_earning_reservations reservation ON reservation.request_id = request.id
    WHERE request.id = request_key AND request.idempotency_key IS NOT NULL GROUP BY request.id;
  IF invalid THEN RAISE EXCEPTION 'payout reservations must equal requested credits' USING ERRCODE = '23514'; END IF;
  IF EXISTS (SELECT 1 FROM payout_earning_reservations r
    JOIN payout_requests p ON p.id = r.request_id JOIN author_earning_ledger e ON e.id = r.earning_id
    WHERE r.earning_id IN (SELECT earning_id FROM payout_earning_reservations WHERE request_id = request_key)
      AND p.status IN ('PENDING','PROCESSING','COMPLETED')
    GROUP BY e.id HAVING sum(r.amount) > e.amount OR bool_or(p.user_id <> e.user_id)) THEN
    RAISE EXCEPTION 'earning is over-reserved or owned by another user' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER payout_reservations_balanced AFTER INSERT ON payout_earning_reservations
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION revenue_check_reservations();
CREATE CONSTRAINT TRIGGER payout_request_reservations_balanced AFTER INSERT OR UPDATE ON payout_requests
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION revenue_check_reservations();

COMMIT;
