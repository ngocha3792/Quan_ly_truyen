# Monetization Sprint 5 — Production hardening

Status: **implemented; live rollout evidence still required**
Date: 2026-09-07

## Delivered

- Backend-enforced rollout stages: `sandbox`, `internal`, `story_allowlist`, and
  `general`. Restricted stages use UUID allowlists and default closed.
- Paywall enforcement is resolved per viewer and story. Purchase and top-up commands
  reject callers outside the active cohort even if they bypass the frontend.
- Locked response serialization drops full-content fields. Unit and database-backed
  integration coverage includes a full-content sentinel.
- Redis-backed, fail-closed one-minute buckets separately protect chapter unlock,
  top-up creation, order polling and signed payment-webhook processing. Bucket keys
  hash their user/provider/IP subject instead of storing it in plaintext.
- Executable anonymous/non-entitled content-leak probe.
- Executable concurrent unlock probe using distinct idempotency keys that asserts one
  purchase, one ledger debit, one wallet balance change, all remaining responses are
  already-owned, and a bounded P95.
- Prometheus rollout, snapshot-health and financial-invariant gauges with critical
  alerts and a `Monetization Safety` Grafana dashboard. Integrity checks cover
  double-entry balance, materialized wallet balance, chapter purchase/refund linkage
  and paid-order linkage.
- Restore drill now requires all wallet, ledger, purchase, entitlement and payment
  tables; it fails on unbalanced entries, wallet drift or invalid financial references.
  Recovery readiness requires `ledgerVerified=true` once monetization is enabled.
- Production rollout and incident-response runbook using the canonical URL
  `https://103.74.100.55.nip.io/`.

## Remaining live blocker

The repository currently implements only `disabled` and `hmac-sandbox` payment
provider modes, and production validation correctly forbids the sandbox adapter.
Internal and wider production rollout therefore remain blocked until a reviewed real
provider adapter and merchant credentials are supplied. This sprint does not disguise
the sandbox adapter as a production integration.

## Validation boundary

Repository tests validate policy, response shape, scripts, configuration and build.
The load probe, external content-leak probe, alert receiver and restore drill must be
run against staging/production infrastructure. They are not considered passed merely
because their code or Compose configuration validates locally.
