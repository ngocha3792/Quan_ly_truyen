# Monetization Sprint 4 — Admin operations, support, and real revenue

Status: **implemented behind existing monetization flags**
Date: 2026-09-07

## Delivered

- Admin payment-order explorer with status, provider, time-range, identity, and
  provider-reference search filters.
- Admin chapter-purchase explorer with user, story, author, status, time-range, and
  free-text filters.
- Idempotent chapter-purchase refund in one PostgreSQL transaction:
  - appends a `REFUND` ledger transaction;
  - credits the reader wallet and debits `PLATFORM_REVENUE`;
  - records the refund transaction, reason, actor, and timestamp on the purchase;
  - revokes the entitlement;
  - creates an immutable audit record;
  - enqueues the reader receipt.
- Repurchase support: a previously revoked entitlement is reactivated and linked to
  the new purchase instead of violating the account/chapter uniqueness invariant.
- Manual admin wallet adjustment through balanced `ADMIN_ADJUSTMENT` entries. The
  actor, reason, prior balance, new balance, request metadata, and transaction id are
  captured in the same transaction's audit record.
- Gross, refunded, and net Credit revenue grouped by chapter, story, and author. The
  query reads signed `PLATFORM_REVENUE` ledger entries; it does not infer or fabricate
  trends.
- In-app and email receipts for successful top-up, chapter purchase, chapter refund,
  and provider-confirmed top-up refund/reversal. Email remains subject to global mail
  configuration, verified email, and the user's channel preference.
- Admin page at `/admin/monetization`, hidden when monetization is disabled.

## HTTP API

| Method | Route                                                        | Permission                     |
| ------ | ------------------------------------------------------------ | ------------------------------ |
| `GET`  | `/api/v1/admin/billing/payment-orders`                       | `payment.read.admin`           |
| `GET`  | `/api/v1/admin/monetization/purchases`                       | `payment.read.admin`           |
| `POST` | `/api/v1/admin/monetization/purchases/:purchaseId/refund`    | `payment.refund.admin`         |
| `GET`  | `/api/v1/admin/monetization/revenue`                         | `analytics.read`               |
| `POST` | `/api/v1/admin/wallets/:userId/adjustments`                  | `wallet.adjust.admin`          |

Both mutation routes require `x-idempotency-key`. Credit and fiat values remain
decimal strings in JSON.

## Refund boundary

This sprint refunds a chapter purchase in Credit. It does not claim that a fiat
top-up was refunded. Fiat refunds/reversals become authoritative only after the
configured provider emits a verified webhook; that webhook appends its own
compensating wallet debit.

## Revenue semantics

The report uses ledger transaction time for its optional interval. Positive platform
entries count toward gross revenue, negative refund entries count toward refunded
revenue, and their signed sum is net revenue. No synthetic comparison period or trend
is returned.

## Rollout

The existing flags still default to false. Before enabling on
`https://103.74.100.55.nip.io/`, apply the Sprint 4 migration, run wallet and payment
reconciliation, verify outbox/worker/SMTP health, exercise refund replay and insufficient
balance cases, and complete backup/restore validation.
