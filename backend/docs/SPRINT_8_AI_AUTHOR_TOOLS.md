# Sprint 8 — AI author tools and moderation

## Author tools

Story and chapter editors now contain an AI tools workspace. Users select an
enabled connection, then request chapter/story summaries, character extraction
with appearances/relationships, or a consistency check against up to five earlier
chapters and known characters. Results are suggestions, never automatic chapter
edits. Characters can be verified; verified records survive later extraction.
Issues can be dismissed, resolved or reopened. Source versions and freshness
warnings distinguish old results from current drafts.

AI author work stays inside the existing AI module:
controller -> application manager/runner -> persistence port -> Prisma adapter.
Creation commits a PENDING job and outbox event atomically. The existing AI
BullMQ worker dispatches `ai.author-job.v1` to the new runner. Redis/outbox and the
worker must be enabled for asynchronous execution; no request thread calls an
external model directly.

The worker claims a fenced lease, rechecks user/story/contributor/connection
access, loads the exact source snapshot and calls the existing gateway. Output
JSON has bounded lists and strings; chapter/block references must belong to the
input. Completion rechecks source under locks and commits job, knowledge and
audit in one transaction. Canceled, superseded or expired leases cannot publish
results. A durable watchdog marks stalled jobs failed without automatically
charging another model request. Explicit retry allows at most two attempts after
the first run. A user can have at most three pending/processing jobs.

Limits: entire-story analysis accepts up to 20 chapters/32,000 source characters.
Consistency context is the target and up to five predecessors, plus at most 40
known characters. The full prompt is bounded to 38,000 characters. Excess input
is rejected clearly, not silently truncated. Larger stories can use chapter
summaries. Requests use a 30-second provider timeout and at most 4,000 output
tokens. These limits bound resource use; no production throughput claim has been
made from unit tests.

## Permissions, audit and billing

Current owner or contributor with `canEdit` may use the tools. Job results belong
to their requester, and every read/mutation/execution rechecks story access.
An explicitly selected missing, foreign or disabled connection is rejected;
another personal connection is not silently substituted. The existing user
`fallbackPolicy` remains `NONE` by default. `SYSTEM` fallback only occurs through
the existing explicit policy and is auditable. The UI shows the current policy.

The gateway keeps rate/quota checks and usage records per provider attempt.
Job audit records job type, actual protocol/model/connection and reported token
counts, including the actual fallback connection. Prompts, drafts, model output,
review notes and raw provider errors are not logged. Jobs persist only version,
content-hash and block-ID references as their source snapshot; prompts are built
at execution. Authorized model results remain private database data.

`totalCost` is nullable and accompanied by `costStatus: UNAVAILABLE`. Current
gateway providers do not return an authoritative monetary charge, so the system
does not invent a token price or present an unknown cost as zero. Canceling a
running job suppresses result persistence but cannot undo an already-started
external provider call or its billing. Source-rejected results may also already
have consumed tokens; provider-attempt usage remains the audit record.

## Translation review

Existing translations now have separate processing and review states, a source
chapter version/hash, and a generation number. Translation remains its existing
job type/table. Worker reads recheck access; lease and generation filters keep a
late result from replacing a newer request. Error messages persisted to Redis,
database or logs are sanitized. Revision requests preserve author notes for the
next generation. Translation source is limited to 32,000 characters.

The UI previews translated title/content and permits editing before approval.
Unsaved local edits must be saved first. APPROVE imports into a DRAFT chapter
only, requiring unchanged source hash, current `expectedVersion`, translation
ID and generation, and ownership of the translation request. Locks follow
story -> chapter -> translation. Import reconciles canonical content block IDs,
counts words, advances the chapter version, creates a retained manual snapshot,
marks the translation APPROVED and audits in one transaction. It never publishes
or bypasses chapter review. REJECT/REQUEST_REVISION require notes and do not
change chapter content. Duplicate or stale approval fails safely.

All paths below are relative to `/api/v1/author/stories/:storyId`:

| Method and path | Operation |
| --- | --- |
| POST `/ai-jobs` | Create with `jobType`, `connectionId`, optional chapter/version |
| GET `/ai-jobs` | Last 30 jobs for the requester |
| GET `/ai-jobs/:jobId` | Job details and source freshness |
| POST `/ai-jobs/:jobId/cancel` | Cancel pending or running work |
| POST `/ai-jobs/:jobId/retry` | Explicitly retry a failed job |
| GET/PATCH `/characters[/:characterId]` | Character timeline and verification |
| GET/PATCH `/consistency-issues[/:issueId]` | Read issues and update disposition |
| POST `/chapters/:chapterId/translations/:language/review` | Review/import with idempotency key |

Translation review body: `decision` (`APPROVE`, `REJECT`, `REQUEST_REVISION`),
`translationId`, `generation`, `expectedVersion`, optional `notes`, and optional
edited `translatedTitle`/`translatedContent`. Approval returns the saved chapter
plus translation; other decisions return a null chapter. The client pauses
editing during import and adopts the acknowledged version without triggering
another autosave.

## Moderation

See [INLINE_COMMENT_MODERATION.md](./INLINE_COMMENT_MODERATION.md). New quotas
cover user/chapter and user/block, including inherited inline replies. Blacklist
enforcement applies to create/edit. Reports capture immutable server-derived
anchor context; admin inbox and detail show the original/submission/verified
versions and location status. Legacy client hints are never verified evidence.

## Deployment and verification boundaries

Migration `20260910020000_ai_author_tools_moderation` adds AI jobs/characters/issues
and translation-review fields. Existing translation processing statuses remain
compatible; historical completed translations start unreviewed. Deploy migration,
API, worker and frontend as one release using the existing production workflow.
Configure `COMMENT_BLACKLIST_TERMS` to activate operator-chosen banned phrases;
the default list is empty. Chapter/block quota defaults are 10 and 3 per hour and
use the existing comment abuse switch. No new provider key is provisioned.

Validation commands:

```powershell
node scripts/verify-api-contracts.mjs
cd backend
npm run db:validate
npm run architecture:check
npm run lint:check
npm run typecheck:scripts
npm run build
npm test -- --runInBand
npm run test:ai:integration
npm run test:comments:integration
cd ../frontend
npm run quality:check
npm run test:ci
npm run build:ci
npx playwright test e2e/public/author-ai-tools-ui.spec.ts e2e/public/inline-report-context-ui.spec.ts --project=public-chromium
```

CI now runs AI author/translation PostgreSQL integration in addition to the
existing comments suite, and the API contract manifest includes the new UI
consumers. Browser tests use controlled API responses: they verify UI interaction,
not real provider quality, charging, PostgreSQL transactions or Redis throughput.
Local PostgreSQL integration remains blocked if test port 5433 is unavailable;
schema validation/compilation do not prove live migration success. No live model
accuracy, provider-cost or production load benchmark is claimed.
