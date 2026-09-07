# Monetization Sprint 2 — Chapter pricing and paywall

Status: implemented behind fail-closed feature flags
Date: 2026-09-07

## Delivered

- Server-owned price bands; authors cannot submit arbitrary Credit amounts.
- Per-chapter `FREE`/`PAID` configuration with a snapshotted Credit price.
- Append-only chapter pricing versions and audited author/admin changes.
- Permanent, account-bound purchase and entitlement records.
- One PostgreSQL transaction for wallet debit, balanced ledger entries, purchase,
  entitlement, wallet projection, and audit log.
- Advisory locks for wallet serialization and purchase idempotency.
- A unique entitlement per user/chapter, so concurrent unlock attempts charge once.
- Public reader response as a discriminated locked/unlocked union.
- Locked responses contain only a server-generated bounded preview; full content is
  queried only after free, entitlement, owner/contributor, admin, or rollout-bypass
  access is resolved.
- Reader unlock UI and author chapter pricing UI.
- Production database gates for all new indexes and manual constraints.

## HTTP API

Routes are unavailable while the corresponding feature flag is false.

| Method  | Route                                                                  | Permission                          |
| ------- | ---------------------------------------------------------------------- | ----------------------------------- |
| `GET`   | `/api/v1/monetization/price-bands`                                    | Public while feature is enabled     |
| `GET`   | `/api/v1/monetization/purchases/me`                                   | `purchase.read.self`                |
| `POST`  | `/api/v1/monetization/chapters/:chapterId/unlock`                     | `purchase.create.self`              |
| `GET`   | `/api/v1/author/stories/:storyId/chapters/:chapterId/monetization`    | `chapter.monetization.manage.own`   |
| `PUT`   | `/api/v1/author/stories/:storyId/chapters/:chapterId/monetization`    | `chapter.monetization.manage.own`   |
| `GET`   | `/api/v1/admin/monetization/price-bands`                              | `monetization.price-band.manage`    |
| `PATCH` | `/api/v1/admin/monetization/price-bands/:priceBandId`                 | `monetization.price-band.manage`    |

Unlock requests require `Idempotency-Key`. BigInt monetary values are serialized as
decimal strings. Existing chapter price snapshots do not change when an administrator
edits a price band; an author must explicitly select/save the band again, producing a
new pricing version.

## Reader access states

- `FREE`: no paid configuration exists.
- `ENTITLED`: the viewer owns an active entitlement.
- `BYPASS`: the viewer is the owner/contributor/admin, or enforcement is deliberately
  disabled during rollout.
- `LOCKED`: only preview metadata is returned; neither `content` nor `contentFormat`
  exists in the response.

A malformed paid configuration fails closed as `LOCKED` rather than exposing chapter
content.

## Verification

Unit tests cover preview bounds, pricing validation, unlock fingerprinting, BigInt
serialization, and locked-response content omission. The database integration suite
prices a published chapter, races two unlock keys, and verifies one debit, one purchase,
one entitlement, and the final wallet balance.

Run the focused database suite with:

```powershell
npm run test:monetization:integration
```

## Rollout state

The defaults remain disabled:

```dotenv
MONETIZATION_ENABLED=false
AUTHOR_PRICING_ENABLED=false
PAYMENT_PROVIDER_ENABLED=false
PAYWALL_ENFORCEMENT_ENABLED=false
```

Sprint 2 does not provide a payment provider or authorize production monetization.
Before enabling enforcement, production must pass migrations, wallet reconciliation,
content-leak tests, support/refund procedures, staged author pricing, and a controlled
entitlement canary. Fiat top-up/webhook settlement remains Sprint 3 scope.
