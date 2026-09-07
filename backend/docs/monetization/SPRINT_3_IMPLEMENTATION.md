# Monetization Sprint 3 — Credit top-up settlement

Status: **provider-neutral foundation implemented; production provider still blocked**
Date: 2026-09-07

## Delivered

- Server-owned Credit packages with integer Credit and fiat-minor-unit snapshots.
- Idempotent payment-order creation protected by a PostgreSQL advisory lock.
- A per-user pending-order cap serialized by a separate PostgreSQL advisory lock.
- A payment-provider port plus an HMAC sandbox reference adapter.
- Raw-body HMAC webhook verification with a bounded timestamp window.
- Durable webhook inbox, duplicate-event detection, payload-collision rejection,
  retry/backoff, stale-claim recovery, and dead-letter state.
- Webhook-only wallet settlement through the immutable, balanced Sprint 1 ledger.
- Amount, currency, provider, provider-reference, order-state, and expiry checks before
  any wallet mutation.
- Idempotent refunds/reversals as compensating wallet debits; the original ledger row
  is never edited.
- Admin package editing with a dedicated permission and immutable audit entries.
- Admin reconciliation counts for paid orders without ledger rows, orphan top-ups, and
  stale pending orders.
- Account Credit page for balance, active packages, top-up redirect, and order history.
  Its navigation is emitted only when the runtime payment-provider flag is enabled.
- Production database gates for every new index and manual constraint.

## HTTP API

All routes except the webhook are guarded by the appropriate feature flag and
permission. The provider adapter itself also fails closed.

| Method  | Route                                              | Permission                                    |
| ------- | -------------------------------------------------- | --------------------------------------------- |
| `GET`   | `/api/v1/billing/credit-packages`                  | Public while payment provider is enabled      |
| `POST`  | `/api/v1/billing/top-up-orders`                    | `payment.order.create.self` + idempotency key |
| `GET`   | `/api/v1/billing/top-up-orders/me`                 | `payment.order.read.self`                     |
| `GET`   | `/api/v1/billing/top-up-orders/:orderId`           | `payment.order.read.self` and ownership       |
| `POST`  | `/api/v1/webhooks/payments/:providerCode`          | Provider signature; no user session           |
| `GET`   | `/api/v1/admin/billing/credit-packages`            | `payment.read.admin`                          |
| `PATCH` | `/api/v1/admin/billing/credit-packages/:packageId` | `payment.package.manage.admin`                |
| `GET`   | `/api/v1/admin/billing/reconciliation`             | `payment.reconcile.admin`                     |

The top-up request uses `x-idempotency-key`. Monetary values are decimal strings in
JSON. Redirect success is never accepted as proof of payment.

## Reference adapter boundary

`PAYMENT_PROVIDER_MODE=hmac-sandbox` exists to exercise the adapter and webhook
contract without claiming a real merchant integration. Environment validation rejects
this mode in production. It must be replaced by a provider-specific adapter only after
the Sprint 0 provider-selection gate is resolved and sandbox credentials exist.

The seeded VND packages are inactive. These defaults remain false:

```dotenv
MONETIZATION_ENABLED=false
PAYMENT_PROVIDER_ENABLED=false
PAYMENT_PROVIDER_MODE=disabled
```

## Settlement invariants

1. Package price is read and snapshotted on the server.
2. A provider event id may map to only one exact payload.
3. Only a verified inbox event can invoke wallet settlement.
4. A successful order uses `payment-order:<orderId>` as its canonical wallet
   idempotency key.
5. A paid order must reference an existing top-up ledger transaction.
6. A refund/reversal appends a compensating debit and never mutates financial history.
7. If the user has already spent the credited amount, reversal fails safely for manual
   support handling instead of creating a negative wallet balance.

## Verification

Unit tests cover provider signatures, timestamp expiry, disabled-provider failure,
durable inbox duplicates, payload collisions, and environment gates. The database
integration test settles a provider event twice and asserts exactly one top-up, one
paid order, and the expected wallet balance.

Run the focused suite with:

```powershell
npm run test:billing:integration
```

## Remaining production gate

Sprint 3 does **not** select or activate a real payment provider. Before enabling real
money, choose the provider, implement and test its official signing/state contract,
configure the production webhook and return URL under
`https://103.74.100.55.nip.io/`, run migrations, pass the billing integration suite,
exercise duplicate/replay/mismatch/refund cases in the provider sandbox, verify worker
backlog and reconciliation, perform backup/restore, and activate only capped internal
packages first.
