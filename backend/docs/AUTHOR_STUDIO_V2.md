# Author Studio v2 — Sprint 7

## Editor and content contract

Author Studio uses a reusable TipTap/ProseMirror editor with headings, emphasis,
lists, quotes, code, links, images, undo/redo and live word/character counts.
Existing tables and task lists survive rich-text edits. It initializes only in
the browser and destroys the editor on navigation. Links/images are restricted
to safe protocols; stored content is never inserted as trusted HTML.

The API still receives Markdown. The backend reconciles existing
`ChapterContentDocument` block IDs when saving. A no-op editor hydration does not
rewrite Markdown or manufacture new block IDs. Reader anchors, search, TTS and
existing chapter history keep their content contract.

## Saving, concurrency and recovery

- Existing DRAFT chapters autosave 2.5 seconds after the last edit. Requests run
  sequentially; a response acknowledges only the submitted local revision and
  never replaces text typed while the request was in flight.
- `PATCH /author/stories/:storyId/chapters/:chapterId` and
  `POST .../:chapterId/autosave` require a positive integer `expectedVersion`.
  Story and chapter rows lock in that order; version comparison, chapter
  update, snapshot and audit commit in the same transaction.
- A stale save/restore receives HTTP 409 `CHAPTER_VERSION_CONFLICT` with
  `details.currentVersion`. The UI pauses autosave and compares local/server
  copies. Keeping local text explicitly saves against the fetched server
  version; another concurrent write causes another conflict.
- IndexedDB `truyenhub-author-recovery` version 2 stores drafts scoped by
  account, story, chapter (or new chapter) and tab. Edits queue locally before
  server acknowledgement; deletion checks the exact saved revision. After
  creation, outstanding local edits migrate to the new chapter key.
- Reload/crash recovery requires a user choice. A BroadcastChannel probe excludes
  live tabs. Recovery against a newer server version enters conflict resolution.
  Storage errors appear in the UI. Internal navigation flushes local writes and
  asks before leaving dirty content; browser unload also warns.

## Chapter approval

Workflow: `DRAFT -> IN_REVIEW -> APPROVED -> SCHEDULED -> PUBLISHED`.
Approved chapters can also publish immediately. Rejection/requested changes
return DRAFT. The owner may reopen APPROVED to DRAFT; that draft must be reviewed
again. Canceling a schedule returns APPROVED.

Chapter reviews have their own `chapter_reviews` table, separate from
StorySubmission. Lifecycle mutations advance version, create retained snapshots
and audit entries. The existing publication transaction owns counters, scheduling
and notification/AI outbox effects. Review alone does not notify followers.

| Route (under `/api/v1`) | Purpose |
| --- | --- |
| `GET /author/stories/:storyId/chapters/:id/workflow` | Status/version, capabilities, review history |
| `POST .../:id/submit-review` | Owner submits DRAFT with expectedVersion |
| `POST .../:id/reopen` | Owner reopens APPROVED with expectedVersion |
| `GET /admin/chapter-reviews` | Paginated IN_REVIEW queue |
| `GET /admin/chapter-reviews/:id` | Review content and previous decisions |
| `POST /admin/chapter-reviews/:id` | expectedVersion, decision, optional comment |

Decisions: `APPROVED`, `REJECTED`, `REQUEST_CHANGES`. Negative decisions require
a comment. Submit/reopen/review require `x-idempotency-key`. Admin UI:
`/admin/chapter-reviews`.

## Permissions and edit sessions

Owner or contributor with `canEdit` can read/edit existing drafts and
view/diff/restore versions. Backend predicates enforce membership. Contributor
mutations and chapter saves share the story row lock so revocation serializes
with editing. Only the active owner can create/delete, submit, reopen, publish,
schedule or change pricing. Reviewers require `chapter.manage.any`; owners and
contributors cannot approve their own story, even with reviewer permission.

Contributor edit routes authenticate and check backend chapter access without
requiring an author dashboard. Workflow capabilities govern UI editing/actions,
including separate `canReopen` for approved unpublished stories.

`POST/GET .../:id/edit-sessions`, `PUT/DELETE .../:id/edit-sessions/:token`
provide advisory presence. Sessions expire after 90 seconds; UI refreshes every
30 seconds. Heartbeat checks chapter/user/tab/token and current edit permission.
Lists never disclose another session's token. Optimistic concurrency remains
the write protection.

## Version history, diff and retention

- Existing `chapter_versions` distinguishes AUTOSAVE, MANUAL_SAVE and PUBLISHED,
  with `isRetained` and `expiresAt`.
- Autosaves expire after seven days. Manual, review/lifecycle, restore and
  publication snapshots are retained. An identical manual save promotes the
  current autosave to a retained manual checkpoint.
- `GET .../:id/versions?includeAutosaves=true` includes autosaves; default false.
- `GET .../:id/versions/diff?from=1&to=2` returns title/content line changes and
  statistics. Both versions are scoped to the authorized story/chapter.
  Expensive diffs fail clearly instead of being silently truncated.
- `POST .../:id/versions/:version/restore` requires `{expectedVersion}` and
  `x-idempotency-key`; it creates a retained new version, even for identical text.
- Worker-only hourly maintenance removes at most 500 expired unretained
  autosaves and 500 expired sessions per tick. Current versions and snapshots
  referenced by chapter reviews are excluded. A PostgreSQL advisory lock
  serializes cleanup across replicas.

## Deployment and verification

Apply `20260910010000_author_studio_v2` via the normal Prisma migration deploy,
regenerate Prisma, then deploy API/worker/frontend together. Existing snapshots
default to retained MANUAL_SAVE. Published/scheduled chapters remain preserved;
drafts must now pass chapter review before publishing. Existing clients must
supply expectedVersion on update/restore.

Checks:

```powershell
cd backend
npm run db:validate
npm run architecture:check
npm run lint:check
npm run typecheck:scripts
npm run build
npm test -- --runInBand
npm run test:stories:integration
npm run test:stories:e2e
cd ../frontend
npm run quality:check
npm run test:ci
npm run build:ci
npx playwright test e2e/public/author-studio-editor-ui.spec.ts --project=public-chromium
```

Six browser tests use controlled API responses for autosave races, reload
recovery, two tabs, restore, submit/reopen and admin decisions. They exercise
real TipTap, Angular routes and IndexedDB; they do not prove PostgreSQL
transactions. Integration tests cover competing saves/reviews, contributor
revocation, snapshot types, retention, unauthorized diff/restore and sessions.
Local PostgreSQL validation is pending while the test server on port 5433 is
unavailable. Existing production build warnings about initial bundle
size/CommonJS remain; TipTap is confined to the lazy editor route.
