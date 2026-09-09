# Revenue share and payout subledger

Sprint 10 adds the schema foundation for financial settlement without deriving
author earnings from analytics or mutating wallet history.

- `RevenueShareAgreement` is versioned per story and stores the effective date
  plus author/platform/contributor shares.
- `RevenueAllocation` snapshots the gross amount and share basis points at the
  purchase. Refunds must create a compensating allocation; the original row is
  never edited.
- `AuthorEarningLedger` tracks settlement delay and the transitions
  `PENDING → AVAILABLE → RESERVED → PAID` (or `FAILED`).
- `PayoutAccount`, `PayoutRequest`, and `PayoutBatch` carry KYC verification,
  payout method, fee/tax fields and immutable request totals.

The migration uses integer minor units for ledger amounts and database checks
for non-negative values and payout net amount. The current payment provider
implementation remains disabled/HMAC sandbox; no payout is sent to a real
provider until a production provider, KYC policy and reconciliation contract
are configured.

Apply migration `20260909040000_add_revenue_payout_subledger` before wiring
settlement workers or payout UI. The next integration step must create
agreements and allocations in the same transaction as completed purchases,
settle only after the configured delay, reserve earnings with row locks, and
reconcile every batch against the payment provider and double-entry wallet
ledger.
