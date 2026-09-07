# Monetization Sprint 0 acceptance record

Date: 2026-09-07  
Result: **accepted with one external provider-selection gate**

## Agreed feature flags

All flags default to `false` in every environment until their rollout gate passes.

| Flag | Purpose | Prerequisite |
| --- | --- | --- |
| `MONETIZATION_ENABLED` | Expose wallet and monetization read models | Sprint 1 reconciliation passes |
| `AUTHOR_PRICING_ENABLED` | Allow eligible authors to configure paid chapters | Price bands and audit trail exist |
| `PAYMENT_PROVIDER_ENABLED` | Allow creation of real top-up orders | Sandbox, webhook, and reconciliation pass |
| `PAYWALL_ENFORCEMENT_ENABLED` | Enforce paid-content access | Entitlement and leak tests pass |

`PAYWALL_ENFORCEMENT_ENABLED` must be the final flag enabled. Disabling payment order
creation must not remove already-purchased access.

## Agreed permissions

Names are contracts for Sprint 1/2 and may be mapped to the existing permission enum
without weakening their boundaries.

- `wallet.read.self`
- `purchase.read.self`
- `chapter.monetization.manage.own`
- `monetization.price-band.manage`
- `payment.read.admin`
- `payment.reconcile.admin`
- `wallet.adjust.admin`
- `payment.refund.admin`

Refund and wallet-adjustment permissions are intentionally separate from ordinary
content administration. Every privileged command requires a reason and audit record.

## Rollout gates

1. Schema and code deploy with all flags disabled; every existing chapter is `FREE`.
2. Ledger invariant, idempotency, concurrency, backup, and restore checks pass.
3. Internal test credits validate purchase and entitlement without real money.
4. Provider sandbox validates signed webhook, duplicates, replay, mismatch, and refund.
5. Internal users validate real top-up with a strict value cap.
6. A small allow-listed story cohort validates content gating and support procedures.
7. Metrics and reconciliation remain clean before broad rollout.

## Provider selection gate

No provider is hard-coded in Sprint 0 because merchant availability, credentials,
sandbox behavior, settlement, and refund capability are deployment inputs. Before
Sprint 3 starts, the owner must select a provider that satisfies all of these:

- Supports the deployment's legal entity and settlement currency.
- Provides server-verifiable webhook signatures and unique event identifiers.
- Has a usable sandbox and documented payment-state transitions.
- Provides refund or reversal status and transaction lookup/reconciliation.
- Allows configured HTTPS webhook and return URLs for the production deployment.
- Publishes operational limits, retry behavior, and credential-rotation procedure.

The adapter contract is mandatory even when only one provider is initially selected.

## Sprint 0 Definition of Done

- [x] Product scope and deferred scope recorded.
- [x] Financial and entitlement invariants recorded.
- [x] Pricing, preview, refund, and access rules recorded.
- [x] Provider trust boundary and threat model recorded.
- [x] Permission boundaries recorded.
- [x] Feature flags and rollout order recorded.
- [x] Public Vietnamese credit/paywall policy page added.
- [x] Existing chapters explicitly default to free for the future migration.
- [ ] First payment provider selected and merchant sandbox credentials available.

The unchecked item is an external readiness gate, not authorization to weaken or skip
the provider adapter, webhook verification, or reconciliation requirements.
