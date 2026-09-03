# Production V1 scope

This document is the human-readable companion to `production-v1.scope.json`. The JSON file is the machine-enforced source of truth for release scope.

## Release rule

Production V1 follows two rules:

1. Every feature marked `required` must be `ready` before a production deployment can start.
2. Every feature marked `deferred` must stay hidden from the Production V1 user experience until its scope decision is changed deliberately.

Normal CI runs the contract check so scope drift is caught on pull requests. The production deployment workflow additionally runs the release check, which intentionally fails while any required capability remains blocked.

Run locally from the repository root:

```bash
node scripts/verify-production-scope.mjs --mode=contract
node scripts/verify-production-scope.mjs --mode=release
```

The second command additionally enforces the release gate: it fails whenever any capability marked `required` is not yet `ready`.

## Production V1 capability matrix

### Required and currently ready

- Account authentication/security and account recovery flows.
- Public catalog, story details and chapter reading.
- Reading history and reading progress persistence.
- Persisted chapter bookmarks with cross-session/device hydration.
- Reader library.
- Comments, reactions, ratings and reporting.
- Author follow and story follow.
- Story contributor workflow: story owners can add, update and remove contributors by account email, role and edit permission.
- Existing notification flows, including deduplicated new-chapter fanout for author and story followers.
- Author application plus admin approval/rejection.
- Author story management and immediate chapter publishing.
- Production media: Cloudinary upload, confirmation, webhook and cleanup flows, running against verified production configuration (`CLOUDINARY_ENABLED=true` with valid credentials).
- Admin user/story/report/moderation/taxonomy/audit operations.
- Public content review: current public static content (terms/privacy/about and marketing/history claims) is accepted for the automated production release baseline.

### Required but currently blocking production

None. All 15 required capabilities are `ready` in `production-v1.scope.json`, and `node scripts/verify-production-scope.mjs --mode=release` currently passes.

If a capability regresses (e.g. Cloudinary credentials are pulled, or new public copy needs review), mark its manifest entry `blocked` with an evidence/blocker note in the same commit that introduces the regression — do not let the manifest and this document fall out of sync again.

## Explicitly deferred from Production V1

The following schema or UI concepts may remain in the repository for future work, but they are not Production V1 promises:

- Author chapter scheduling (`scheduledAt`). Immediate publishing remains supported.
- Weekly reading-time statistics (`ReadingSession`).
- Chapter version-history workflow (`ChapterVersion`).
- Personalized recommendation claims.
- Heuristic author monthly goals and chapter scheduling trends. Synthetic trends, gamified level/XP and fake comment unread state are not exposed in V1.

Deferred items are protected by source guards where a misleading user-facing exposure previously existed. Persistence fields may remain when removing them would create unnecessary migration churn.

## How to change scope safely

A scope change is a product decision, not a CI workaround.

To promote a deferred feature:

1. Implement the domain/application/infrastructure/presentation flow using the existing module boundaries.
2. Connect the frontend through `domain -> data-access -> pages/ui`; do not bypass repositories/stores with ad-hoc HTTP calls.
3. Add unit/integration/E2E coverage for the promoted capability.
4. Change its manifest entry from `deferred` to `required` with `readiness: ready` and `productionExposure: enabled` only after the behavior is complete.
5. Remove or update obsolete `sourceGuards` for that feature.
6. Run the contract and release checks, then the full CI suite.

To close a required blocker, update only the `readiness`, `productionExposure`, blocker fields and evidence/notes after the implementation and production configuration have been verified.

## V1 non-goals

Production V1 is not blocked on recommendation ML, collaborative authoring, chapter revision history, scheduled publishing or gamified author goals. Those capabilities can be delivered after the first stable production release without changing the core architecture.
