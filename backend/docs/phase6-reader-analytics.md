# Phase 6 Reader Analytics runbook

## Metric source map

- `STORY_VIEW`: browser only, after a public story detail is rendered. It increments `Story.viewCount` and `StoryDailyStat.viewCount`. It is not emitted by SSR or the public story query handler.
- `CHAPTER_VIEW`: browser only, after a public chapter is rendered. It increments `Chapter.viewCount` and `ChapterDailyStat.viewCount`. It does **not** increment `Story.viewCount`.
- `READING_STARTED`: one logical start per `sessionId + chapterId`, emitted after five seconds of active visible reading.
- `READING_PROGRESS`: bounded active-time heartbeat. Hidden/inactive tabs do not accumulate reading seconds.
- `READING_COMPLETED`: one completion per `sessionId + chapterId` when progress reaches the configured threshold.

Every event has version `1`. `eventId` is the retry/idempotency identity and is database-unique.

## Privacy

Raw analytics never store email, raw authenticated user IDs, raw anonymous IDs, full IPs, cookies, tokens or user-agent strings. Viewer identity is `HMAC-SHA256(ANALYTICS_IDENTITY_HMAC_SECRET, "user:<id>" | "anon:<id>")`. Author APIs expose aggregates only. Multi-day `uniqueReaders` totals are the sum of canonical daily unique-reader buckets (reader-days); no reader identity is exposed or retained long-term solely to deduplicate across arbitrary date ranges. Rotating the HMAC secret intentionally breaks unique-reader continuity across the rotation boundary within raw-event retention.

## Consistency and freshness

Ingestion durably writes `ReaderAnalyticsEvent` first and attempts queue delivery second. Queue/Redis failure does not roll back the accepted raw event and never blocks public content rendering. Recovery dispatch requeues stale/unqueued rows. Aggregation locks unprocessed rows, updates daily/lifetime counters, and sets `processedAt` in the same transaction, so worker replay is a no-op.

- daily/lifetime counters: eventually consistent, normally about one minute
- daily unique readers: canonical `COUNT(DISTINCT viewerKeyHash)` reconciliation, normally within five minutes
- author dashboard: eventually consistent; UI says data may lag a few minutes

The daily analytics timezone is `ANALYTICS_TIME_ZONE` (default `Asia/Ho_Chi_Minh`).

## Completion math

`completionRate = completions / readingStarts`. If `readingStarts = 0`, the API returns `null`, not a fake zero percent. Reading seconds are the sum of bounded active-heartbeat seconds.

## Reconciliation and backfill

`npm run maintenance:reader-analytics` is dry-run by default. `--apply` sets canonical event-derived daily metrics; it does not blindly increment them.

`npm run maintenance:reader-analytics-backfill` is dry-run by default and only uses trustworthy `ReadingSession` history for starts/completions/reading seconds. It intentionally does not invent historical story/chapter views.

Existing pre-Phase-6 `viewCount` values must be classified before production enablement: real legacy production counts may be retained as a documented lifetime baseline; staging/demo/synthetic counters should be reset/reseeded rather than presented as production truth.

## Retention

Processed raw events are retained for `ANALYTICS_RAW_EVENT_RETENTION_DAYS` (default 30) and cleaned in bounded batches. Unprocessed rows are never removed by normal retention cleanup. Daily aggregates remain long-lived.

## Rollout

Deploy schema + ingestion + worker + author API first with `ANALYTICS_ENABLED=false`, verify health, then enable staging and finally deploy/enable browser telemetry. Reader functionality must remain healthy while the analytics queue/worker is stopped.
