# Monetization and paywall

Status: **accepted for implementation**  
Decision date: **2026-09-07**  
Implementation state: **Sprint 3 top-up settlement foundation implemented; monetization is not live**

This directory is the source of truth for the first monetization release. Later
sprints must not introduce behavior that conflicts with these decisions without a new
ADR.

## Product baseline

- The domain currency is named `CREDIT`. The Vietnamese UI may label it `Xu`.
- Credits are integer units. Fiat amounts are integer minor units and always carry an
  explicit ISO currency code.
- V1 supports server-defined credit packages and permanent, account-bound chapter
  unlocks.
- Credits cannot be transferred between users, redeemed for cash, or expire in V1.
- Existing chapters remain free after the monetization migration.
- Subscription access, gifts, promotional balances, author cash-out, and automated
  revenue sharing are out of scope for V1.
- A payment-provider redirect is informational. Only a verified, persisted webhook
  may settle a top-up order and credit a wallet.

## Source-of-truth hierarchy

1. PostgreSQL immutable ledger is the financial source of truth.
2. `Wallet.balance` is a transactionally maintained materialized balance.
3. Entitlement rows are the source of truth for paid chapter access.
4. Redis may cache projections, but it must never authorize spending or access.
5. Frontend state is never trusted for price, balance, payment state, or entitlement.

## Documents

- [ADR-001-credit-and-pay-per-chapter.md](./ADR-001-credit-and-pay-per-chapter.md)
  defines the chosen product and architecture.
- [THREAT_MODEL.md](./THREAT_MODEL.md) defines security boundaries and required
  mitigations.
- [SPRINT_0_ACCEPTANCE.md](./SPRINT_0_ACCEPTANCE.md) records permissions, feature
  flags, rollout gates, and unresolved external dependencies.
- [SPRINT_1_IMPLEMENTATION.md](./SPRINT_1_IMPLEMENTATION.md) records the wallet,
  ledger, API, reconciliation, and verification contract now implemented.
- [SPRINT_2_IMPLEMENTATION.md](./SPRINT_2_IMPLEMENTATION.md) records chapter price
  bands, purchase/entitlement atomicity, content gating, APIs, and rollout state.
- [SPRINT_3_IMPLEMENTATION.md](./SPRINT_3_IMPLEMENTATION.md) records Credit packages,
  payment orders, verified webhook settlement, reconciliation, and the remaining
  provider-selection gate.

## Public policy

The Vietnamese customer-facing policy is implemented at
`/chinh-sach-credit`. It deliberately describes only the accepted V1 behavior and
states that its payment provisions apply when monetization is enabled.
