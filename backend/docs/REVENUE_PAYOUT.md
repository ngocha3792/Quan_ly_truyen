# Revenue share and payout subledger

Sprint 10 implements financial settlement without deriving author earnings
from analytics or mutating wallet history.

- `RevenueShareAgreement` is versioned per story and stores the effective date
  plus author/platform/contributor shares.
- `RevenueAllocation` snapshots the gross amount and share basis points at the
  purchase. Refunds create a compensating allocation; the original monetary
  snapshot stays immutable while its operational status may advance.
- `AuthorEarningLedger` tracks the settlement delay and `PENDING → AVAILABLE`.
  Immutable partial reservation rows and payout request statuses represent
  reserved, paid, failed, and released balances without changing earning amounts.
- `PayoutAccount`, `PayoutRequest`, and `PayoutBatch` carry KYC verification,
  payout method, fee/tax fields and immutable request totals.

The subledger uses integer Credits, basis points, and database checks for
balanced allocations, immutable monetary snapshots, and payout net amounts.
Negative rows compensate refunds without editing the original financial data.
Integer rounding keeps the total exact and assigns residual Credits to the
author before contributors, with no residual assigned to a zero-share recipient.
The payout workflow records manually verified bank/provider transfers; reader
top-up providers are a separate integration and do not execute author payouts.

Apply `20260910110000_complete_revenue_payout` after the original subledger
migration. `allocatePurchaseRevenue(tx, purchaseId)` and
`refundPurchaseRevenue(tx, purchaseId)` run inside the purchase/refund
transaction. When sharing is enabled, a missing approved agreement rolls back
the purchase, wallet debit, and entitlement. A worker settles due earnings
every minute using the delay snapshotted at purchase time. Partial withdrawals
reserve exactly the requested amount with immutable reservation rows;
concurrent requests share a transaction lock. Refunds after reservation or
payment leave debt that blocks further withdrawal.

## Rollout and daily operations

1. Deploy the migration, API and worker from the same release. The migration
   starts with revenue disabled and clears old unaudited payout-account
   approvals, which require an explicit KYC review.
2. In the admin revenue policy screen, configure the platform user, minimum
   platform share, settlement delay, minimum withdrawal, fee/tax basis points
   and positive `fiatMinorPerCredit` conversion. VND is supported. These are
   operator-approved business values; the app does not infer a legally correct
   tax rate or a conversion rate from top-up packages.
3. Create approved agreement versions for paid stories before enabling
   revenue. Existing purchases are not silently backfilled or repriced.
4. Review identity and bank/e-wallet ownership using the private case named by
   `kycReference`. Record a case reference and a review reason; do not paste
   identity documents into public media. An author cannot self-verify.
5. Select pending requests into a batch and export the snapshotted payee/VND
   amounts. Perform the transfer using the approved bank/provider channel,
   then record its unique transaction ID and evidence reference. An ambiguous
   bank timeout requires provider reconciliation before marking failure or
   retrying the transfer.
6. Compare the reconciliation report with bank/provider statements and
   payment/wallet clearing records. Investigate journal imbalances, reservation
   mismatches, negative author availability, or unexplained transfer differences
   before approving another payout. Keep the settlement worker running.

`PayoutRequest` snapshots gross, fee, tax, net, conversion, policy, and payee;
subsequent policy or account changes cannot rewrite them. Cancelling a pending
request or failing a processing request releases availability. Completion
records the transfer and balanced paid/fee/tax journal entries. Batches close
after every request is terminal. Repeating an identical request/batch operation
is idempotent.

Automated bank/MoMo/ZaloPay disbursement, KYC-vendor checks, tax filing and
importing external bank statements require real contracts/credentials. Those
external operations are not simulated as successful by the application.

## Verification contract

The PostgreSQL regression suite is run with:

```sh
npm run test:revenue:integration
```

It uses the isolated `TEST_DATABASE_URL` database and exercises the durable
invariants that unit tests cannot prove: allocation totals and integer
rounding, approved-agreement selection, immutable snapshots, settlement delay
and retry idempotency, compensating refund rows, row-locked partial payout
reservations, KYC and ownership gates, policy/account snapshots, payout batch
completion/failure, and journal reconciliation. The CI job applies all
migrations to a fresh PostgreSQL service before running this suite.

The suite does not claim an external bank, tax authority, KYC vendor, or live
payment gateway has been contacted. Provider transfer evidence is supplied by
an administrator at completion/failure, and production rollout remains
disabled until those integrations and reconciliation credentials are reviewed.
