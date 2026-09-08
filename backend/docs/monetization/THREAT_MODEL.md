# Monetization threat model

Date: 2026-09-07  
Scope: credit top-up, wallet, chapter purchase, entitlement, paid-content delivery

## Assets

- Fiat payment orders and provider references.
- Wallet balances and immutable ledger history.
- Chapter prices, purchases, and entitlements.
- Paid chapter content.
- Webhook secrets, provider credentials, and administrative actions.

## Trust boundaries

- Browser/mobile client to API.
- Payment provider to public webhook endpoint.
- API to PostgreSQL transaction boundary.
- API to Redis/BullMQ and background worker.
- SSR/Nginx/CDN cache to personalized content response.
- Support/admin operator to privileged adjustment and refund commands.

## Required controls

| Threat                                   | Required mitigation                                                       | Verification                                   |
| ---------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------- |
| Client changes price or package amount   | Resolve active package and chapter price on the server                    | Integration tests with tampered payloads       |
| Duplicate unlock or webhook              | Unique idempotency/event keys and deterministic replay result             | Concurrent and replay tests                    |
| Wallet double-spend                      | PostgreSQL row lock or serializable transaction; balance constraint       | Parallel purchase test against one wallet      |
| Forged webhook                           | Provider signature and timestamp verification over raw payload            | Invalid, expired, and modified signature tests |
| Redirect used as proof of payment        | Redirect only displays/polls order state; verified webhook settles        | End-to-end negative test                       |
| Out-of-order provider events             | Explicit state-transition table and event inbox                           | Reordered event fixtures                       |
| IDOR on wallet/order/entitlement         | Derive owner from authenticated principal, not request user id            | Cross-account API tests                        |
| Paid content hidden only in UI           | Backend entitlement gate; locked response omits full content              | Response-body and SSR snapshot tests           |
| Shared cache leaks content               | `private, no-store` for personalized content; cache key review            | Proxy/cache integration test                   |
| Ledger tampering                         | Append-only application API, restricted DB role, audit and reconciliation | Permission and reconciliation checks           |
| Privileged fraud                         | Dedicated permissions, mandatory reason, audit event, alerting            | Admin authorization tests                      |
| Manual settlement without cryptographic proof | Dedicated settlement permission, mandatory reason, compare-and-swap status, unique ledger reference, and same-transaction audit | Claim/confirm/reject authorization and replay tests |
| Secret exposure                          | Secrets only in deployment secret store; redact payload/log fields        | Log and configuration scan                     |
| Worker retry credits twice               | Atomic state transition plus unique ledger reference                      | Crash-after-commit replay test                 |
| Refund creates negative balance silently | Review state when granted credits were spent                              | Refund scenario tests                          |

## Content delivery rule

The current public chapter response cannot become a paywall by adding a `locked` flag
while retaining content. Sprint 2 must split public metadata/preview from gated content,
or use a discriminated response that constructs the locked variant before content is
loaded. Full paid content must not cross the API boundary for a locked viewer.

## Abuse controls

- Apply rate limits separately to order creation, unlock, order polling, and webhook
  endpoints.
- Reject user-supplied callback/redirect hosts; use configured allow-listed URLs.
- Limit pending orders per user and expire abandoned orders.
- Store a payload hash for forensic comparison while redacting secrets and sensitive
  payment data from logs.
- Alert on repeated amount mismatches, signature failures, adjustment volume, wallet
  reconciliation drift, and old webhook backlog.

## Operations failure modes

- Database committed, response lost: retry returns the original idempotent result.
- Provider webhook received, worker unavailable: inbox retains event until retry.
- Provider reports paid, internal credit missing: reconciliation queues remediation.
- Ledger and wallet projection differ: freeze affected wallet mutations and alert;
  rebuild the projection from ledger only through an audited runbook.
- Entitlement cache stale: database remains authoritative and cache is invalidated after
  commit.

## Sprint 5 review outcome

Implemented repository controls:

- Rollout is enforced in backend purchase, top-up and chapter-delivery paths; restricted
  cohorts default closed and cannot be bypassed by changing frontend state.
- Money movement and payment status routes have separate Redis buckets for unlock,
  order creation, polling and webhooks. Protection fails closed while monetization is
  enabled and Redis is unavailable.
- Locked chapter serialization is allow-listed and covered by a unique full-content
  sentinel test. A staging probe repeats the check for anonymous and non-entitled users.
- Concurrent unlock probing uses distinct idempotency keys and verifies a single
  purchase, ledger transaction and wallet debit.
- Financial integrity metrics reconcile double-entry transactions, wallet projections,
  purchases, refunds, paid orders and payment-webhook backlog.
- Restore readiness requires the financial tables and a successful full-ledger invariant
  check before monetization can be treated as recoverable.

Residual risks that require live evidence before widening rollout:

- SSR/Nginx/CDN cache behavior must pass the external content-leak probe with a real paid
  chapter and non-entitled account.
- Database locking and latency must pass the concurrent unlock probe under staging load;
  unit tests do not demonstrate production capacity.
- Alert routing, backup media and restore timing require an operator drill against the
  deployed stack.
- A reviewed production payment-provider adapter is still absent. The `hmac-sandbox`
  adapter is intentionally rejected in production.

## Manual bank transfer exception

`MANUAL_BANK_TRANSFER` is explicitly human-attested and is not represented as a
provider-signed webhook. A user claim can only move `PENDING` to `AWAITING_REVIEW`;
only an administrator with `payment.order.settle.admin` may settle it, with a
10–500 character reason. Manual confirmation and webhook success share the same
atomic settlement transaction and `payment-order:<id>` ledger idempotency key.
