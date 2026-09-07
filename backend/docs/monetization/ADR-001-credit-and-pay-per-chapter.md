# ADR-001: Internal credits and permanent chapter unlocks

- Status: Accepted
- Date: 2026-09-07
- Owners: Product, backend, frontend, operations

## Context

The platform currently publishes public chapter content and has no wallet, payment,
purchase, or entitlement domain. Monetization must fit the existing NestJS modular
monolith, PostgreSQL/Prisma transaction model, Redis/BullMQ workers, durable outbox,
audit log, notifications, and inbound webhook patterns. It must also avoid leaking
paid content through the public Angular SSR response or shared caches.

## Decision

V1 uses an internal, non-transferable currency named `CREDIT`. Readers obtain credits
through server-defined top-up packages and spend them to permanently unlock individual
chapters for their account.

The solution remains inside the current modular monolith and introduces three bounded
contexts:

- `wallets`: wallet projection, immutable double-entry ledger, and reconciliation.
- `billing`: credit packages, payment orders, provider adapters, and webhook inbox.
- `monetization`: chapter pricing, purchases, access policy, and entitlements.

The first provider is selected at deployment preparation time through a provider
adapter. Provider-specific identifiers and payloads must not enter wallet or
entitlement domain models.

## Financial invariants

1. Credit and fiat values use integers; floating-point arithmetic is forbidden.
2. Fiat values include a currency code. Credit and fiat never share the same amount
   column.
3. Each ledger transaction is immutable and balanced: the sum of entries is zero.
4. `idempotencyKey` is unique for every externally retryable command.
5. A wallet may not spend below zero.
6. A top-up is credited at most once for a unique provider event/order.
7. A chapter is charged at most once per user.
8. Refunds and reversals use compensating ledger transactions; history is not edited.
9. The purchase stores a price snapshot. Later price changes do not alter it.
10. Administrative adjustments require a reason, permission, actor, and audit event.

## Access policy

- `FREE` chapters require no entitlement.
- `PAID` chapters return full content only when the viewer owns an active entitlement
  or has an explicit owner/contributor/admin bypass.
- Anonymous and unauthorized requests receive metadata plus a server-controlled
  preview, never the complete content.
- Personalized content responses use private, non-shared caching. Paid content must
  not appear in SSR HTML, logs, analytics payloads, or public search documents.
- Unlocks are permanent in V1 unless a confirmed refund, fraud reversal, or
  administrative remediation explicitly revokes the entitlement.

## Pricing policy

- Administrators maintain a small set of allowed price bands.
- Eligible authors choose a band; arbitrary credit values are rejected.
- A new or migrated chapter defaults to `FREE`.
- Pricing changes are versioned and audited.
- A price change affects future purchases only.
- Bulk pricing is allowed only for chapters owned by the author and must show the
  affected count before confirmation.

## Refund policy

- Duplicate charges, confirmed payment errors, and service failures are eligible for
  review.
- A successful top-up refund reverses the related credit grant. If credits were
  already spent, the case requires support review; V1 does not silently create a
  negative balance.
- A chapter-purchase refund creates compensating entries and may revoke the matching
  entitlement.
- Refund outcomes and timing depend on the payment provider. The public policy must
  avoid promising a fixed provider processing time.

## Provider trust boundary

- Checkout packages and prices come from the backend, never the browser.
- Webhooks are signature-verified using the raw request body where required.
- The webhook is persisted and deduplicated before asynchronous processing.
- The worker verifies provider reference, order, currency, amount, and valid state
  transition before crediting a wallet.
- Browser return/callback URLs never settle orders.
- Out-of-order, duplicate, invalid, and unknown events are retained for operations
  without changing balances.

## Consequences

This design adds more tables and transaction discipline than a mutable balance field,
but provides a durable audit trail and deterministic recovery. Pay-per-chapter is less
flexible than launching subscriptions immediately, but keeps the first entitlement
model understandable and testable. Author payouts remain a later, separately reviewed
system because they introduce materially different operational requirements.

## Explicitly deferred

- Subscription plans or timed access.
- Transfer, gifting, withdrawal, expiration, and multiple internal currencies.
- Promotional or bonus-credit accounting.
- Automated author revenue allocation and payout.
- Cross-provider smart routing.
- Offline purchases.
