# Monetization Sprint 1 — Wallet and ledger foundation

Status: implemented behind a fail-closed feature flag
Date: 2026-09-07

## Delivered

- `Wallet` materialized balance with integer `CREDIT`, non-negative balance, and
  monotonic version. A bounded maximum prevents database and client integer overflow.
- Immutable `WalletLedgerTransaction` and `WalletLedgerEntry` records.
- Two-entry posting: one user-wallet entry and one system-account entry.
- Deferred PostgreSQL constraint trigger that rejects incomplete, mismatched, or
  unbalanced transactions at commit.
- PostgreSQL advisory locks for global idempotency keys and per-user wallets.
- Request fingerprint validation for idempotency-key reuse.
- Per-wallet business-reference uniqueness for financial operations.
- Authenticated balance and paginated history read APIs.
- Dry-run reconciliation command that fails on projection or ledger drift.
- Migration-time permission provisioning for existing `USER`, `AUTHOR`, and `ADMIN`
  roles.
- Unit, configuration, guard, migration-contract, idempotency, concurrency, and
  database-constraint integration tests.

## HTTP API

The routes are unavailable while `MONETIZATION_ENABLED=false`.

| Method | Route                            | Permission         | Description                                        |
| ------ | -------------------------------- | ------------------ | -------------------------------------------------- |
| `GET`  | `/api/v1/wallet/me`              | `wallet.read.self` | Current Credit balance and projection version      |
| `GET`  | `/api/v1/wallet/me/transactions` | `wallet.read.self` | Own transaction history with `page` and `pageSize` |

All amounts are decimal strings in JSON to avoid unsafe JavaScript number conversion.
An account with no wallet receives a virtual zero balance; reads do not create database
state.

## Internal posting contract

Future billing and chapter-purchase modules import `WalletsModule` and execute
`PostWalletTransactionCommandHandler`. Callers must provide:

- User, currency, transaction type, direction, and a strictly positive integer amount.
- A system counter-account.
- An idempotency key between 8 and 200 characters.
- A stable, wallet-local operation reference type and identifier. For example, use a
  content-purchase ID rather than a bare chapter ID.

The handler normalizes reference text, fingerprints financial semantics, and returns
the original result on a replay. Reusing a key for different financial semantics
returns `IDEMPOTENCY_CONFLICT`.

## System accounts

- `PAYMENT_CLEARING`: counter-account for a confirmed top-up.
- `PLATFORM_REVENUE`: counter-account for a paid-content purchase.
- `ADJUSTMENT`: counter-account for an explicitly authorized adjustment or reversal.

No public credit/debit endpoint exists. Provider settlement, chapter unlock, refunds,
and admin adjustment remain later use cases with their own permissions and audit
requirements.

## Reconciliation

Run:

```powershell
npm run maintenance:wallet-reconciliation
```

Optionally inspect one wallet:

```powershell
npm run maintenance:wallet-reconciliation -- --wallet-id <uuid>
```

The command is deliberately read-only. It exits with an integrity failure when:

- `Wallet.balance` differs from the sum of its wallet ledger entries; or
- Any transaction lacks exactly one matching wallet entry and one system entry; or
- Any transaction entries do not sum to zero or disagree with `walletAmount`.

It does not auto-repair financial state. A repair requires a reviewed runbook and an
audited compensating transaction.

## Rollout state

These defaults remain in both development and production examples:

```dotenv
MONETIZATION_ENABLED=false
AUTHOR_PRICING_ENABLED=false
PAYMENT_PROVIDER_ENABLED=false
PAYWALL_ENFORCEMENT_ENABLED=false
```

Sprint 1 does not authorize enabling paywall enforcement. The production scope keeps
monetization deferred and hidden until the later payment, entitlement, content-leak,
reconciliation, and support gates pass.
