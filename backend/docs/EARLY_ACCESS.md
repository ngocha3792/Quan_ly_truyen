# Early-access chapter pricing

Author Studio → edit chapter → **Quyền truy cập chương** supports:

- `FREE`: public reading; no price band or opening schedule.
- `PAID` + `PERMANENT_PAID`: existing permanent paid access.
- `PAID` + `EARLY_ACCESS`: an active price band and exactly one of `freeAt` (ISO date/time) or `paidWindowDays` (integer 1–3650).

The existing `PUT /author/stories/:storyId/chapters/:chapterId/monetization` contract accepts those fields. The author form sends the selected date as UTC and renders it in the author's local timezone. Supplying a date in the past opens access immediately. Input validation rejects incomplete or ambiguous early-access schedules.

`paidWindowDays` is measured as elapsed 24-hour days from `Chapter.publishedAt`, not pricing creation or schedule submission. It can be configured on a draft; until publication there is no derived deadline. Read DTOs return the resolved `freeAt`, while persisted relative configuration and immutable `ChapterPricingVersion` records remain unchanged.

The exported domain policy `isChapterEffectivelyFree` resolves access at `now >= freeAt`. Reader access, anchored comments and replies, TTS, offline packages, and search result access labels use this rule. Invalid stored schedules fail closed. Authenticated media continues using signed delivery after its chapter becomes free.

Reader `chapter.access` additionally returns `unlockPolicy` and `freeAt`, so the paywall can display when free reading starts. The API resolves access on each request; opening the chapter again after the deadline returns full content and `FREE` with no price. Paid search documents retain only their server-controlled public preview even after early access expires. Search labels recheck PostgreSQL instead of trusting a cached index label.

Purchases retain permanent active entitlements and their original Credit price. Pricing changes append a new pricing snapshot. Purchase creation serializes with pricing updates and refuses a new purchase when access is already free; existing idempotent or owned-purchase responses remain valid without another debit.

Existing monetization flags and rollout controls continue to apply: `MONETIZATION_ENABLED`, `AUTHOR_PRICING_ENABLED`, `PAYWALL_ENFORCEMENT_ENABLED`, `MONETIZATION_ROLLOUT_STAGE`, `MONETIZATION_STORY_ALLOWLIST_IDS`. Gateway provider/story rollout is configured separately by the Admin payment gateway UI.

## Verification

Unit tests cover the millisecond before, exactly at, and after the deadline, explicit versus publication-relative schedules, draft behavior, invalid settings, inline replies, TTS access, and authenticated offline media. Frontend component tests cover preserving relative schedules, invalid input, and switching to free access.

PostgreSQL integration regressions are included in:

- `test/integration/monetization.integration-spec.ts`: access transition, no new charge after expiry, permanent entitlements, immutable pricing/purchase snapshots, draft-relative windows.
- `test/integration/offline-reading.integration-spec.ts`: creating an entitlement-free package exactly at expiry.
- `test/integration/search.integration-spec.ts`: current access label and preview-only indexing after expiry.

Run the respective `test:monetization:integration`, `test:offline-reading:integration`, and `test:search:integration` scripts after PostgreSQL test setup is available.
