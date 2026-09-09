# Sprint 6: full-text and fuzzy search

Search is available at `/tim-kiem` and in the header. `GET /api/v1/search`
uses Meilisearch when enabled and an active generation exists. On engine
failure, missing index, or stale hits it uses the live PostgreSQL projection.
A 10-second circuit breaker bounds repeated engine timeouts.

## Configuration

Apply `20260909020000_add_search_indexing` before deploying the API. The
migration requires PostgreSQL `unaccent` and `pg_trgm`. It adds two read views,
title trigram indexes, transactional search outbox triggers, a dirty-document
table and a rebuild checkpoint. It does not copy paid chapter bodies into an
external index or store users' search strings.

PostgreSQL search is the default (`SEARCH_MEILISEARCH_ENABLED=false`). To enable
the primary engine, set the following on **both API and worker**:

```dotenv
SEARCH_MEILISEARCH_ENABLED=true
MEILISEARCH_HOST=http://meilisearch:7700
MEILISEARCH_INDEX=reader_search
MEILISEARCH_API_KEY=<server-only-key-at-least-16-characters>
REDIS_ENABLED=true
QUEUE_ENABLED=true
```

Development: enable profile `search` in `docker/compose.dev.yml`. The engine is
bound to localhost:7700. The Compose key and backend key must match; when running
Node outside Docker use `MEILISEARCH_HOST=http://127.0.0.1:7700`.

Production: add `-f compose.search.yml --profile search` to the usual Compose
command. The overlay keeps Meilisearch on the private backend network, persists
its data, and limits indexing to one thread / 256 MB (container limit 512 MB).
The pinned v1.10 API contract is tested in CI. The master/admin key must never
be put in Angular runtime config or used by browsers.

## Query contract

`GET /api/v1/search?q=dau%20pha&kind=story&page=1&pageSize=20`

| Parameter | Values |
| --- | --- |
| `q` | Up to 200 characters; empty query browses visible content. |
| `kind` | `story` (default) or `chapter`. |
| `category`, `tag` | Category/tag slug; options from `/search/filters`. |
| `status` | `published`, `hiatus`, `completed`. |
| `contentRating` | `everyone`, `teen`, `mature`. |
| `yearFrom`, `yearTo` | Inclusive years; inverted ranges return validation errors. |
| `featured` | `true` or `false`. |
| `storyId` | UUID to restrict chapter search to one story. |
| `sort` | `relevance`, `newest`, `views`, `followers`, `rating`. |
| `page`, `pageSize` | 1–1000 and 1–20. |

The normal API envelope contains `hits`, `totalHits`, `page`, `pageSize`,
`totalPages`, `query`, `engine` and `processingTimeMs`. Hits include title,
plain-text snippet, author, taxonomy and a story/chapter route. Snippets have a
240-character window plus ellipses. Angular renders plain interpolation.

Both engines normalize Vietnamese accents including đ/Đ. PostgreSQL combines
weighted full-text matching, title substring matching and trigram similarity.
Meilisearch additionally applies typo tolerance; title/author/taxonomy rank
ahead of body text. Engine relevance scores are not expected to be identical.

## Visibility and entitlement

Only published chapters inside public, published/hiatus/completed stories are
eligible. Private, unlisted, deleted, hidden and draft content is excluded.
Paid chapters expose only their public preview, for every viewer. A batched
entitlement check labels results `FREE`, `ENTITLED` or `LOCKED`; entitlement
requires an active grant backed by a completed purchase.

The engine returns only document IDs and source fingerprints. The API reads
current PostgreSQL data and verifies each fingerprint before producing a
snippet. A free-to-paid, hide, delete, rename or filter-relevant change forces
PostgreSQL fallback for that result page until indexing catches up. Ranking
counters can be eventually consistent without invalidating a content fingerprint.

## Indexing and rebuild recovery

Database triggers capture story/chapter publication, edits, removal, pricing,
author name and taxonomy changes in the same transaction. Repeated changes
coalesce while a document is dirty. An outbox notification goes to the `search`
queue; a five-second worker sweep also recovers dirty work after lost/exhausted
queue jobs. The consumer reloads current data and uses replacement upserts or
tombstone deletion. Every external write waits for Meilisearch task success.

`POST /api/v1/admin/search/rebuild` requires `search.manage`, assigned to ADMIN.
It returns 202 and persists the request; `GET /api/v1/admin/search/status` shows
phase, cursor, backlog and last error. Repeated requests while rebuilding reuse
the existing operation. Initial startup requests a rebuild automatically.

Phases: REQUESTED → SCANNING → CATCHUP → IDLE. A unique shadow index is scanned
in batches of 100; changes are written to active and shadow generations. A
PostgreSQL advisory transaction lock serializes index operations across worker
replicas. Dirty revisions are compared before deletion so a concurrent edit
is retained for the next pass. Cursors commit only after confirmed engine tasks.

After catch-up, a single database update changes the logical active-index
pointer. No live index is cleared. The retired index is deleted on a later
sweep. If a process crashes or a task fails, restart the worker: it resumes the
stored generation/cursor, safely repeats completed writes and keeps the previous
active index serving. Keep API/worker `MEILISEARCH_INDEX` consistent during rollout.

## Monitoring and validation

Grafana dashboard **Search** contains query P95, indexing lag, failed document
attempts, empty-query rate and result-empty rate. Prometheus records bounded
labels only, never query strings or user IDs. Alert `SearchIndexingLag` fires
when the oldest pending change exceeds five minutes; zero means caught up,
not time elapsed since the last successful job.

Run `npm test -- --runInBand src/modules/search` for unit tests. Run
`npm run test:search:integration` against an isolated `TEST_DATABASE_URL` for
real PostgreSQL projection, paid-content and rebuild tests. With
`SEARCH_TEST_MEILI_HOST` and `SEARCH_TEST_MEILI_KEY`, the integration suite also
tests actual Meilisearch tasks, Vietnamese typo matching and deletion. CI
provides PostgreSQL, Redis and Meilisearch services for this check. Browser
tests live in `frontend/e2e/public/search.spec.ts`.

The <100 ms P95, <30 s indexing lag and 10k-document rebuild targets require
staging measurements with representative data; passing mocked adapter/unit
tests alone does not establish those operational targets.
