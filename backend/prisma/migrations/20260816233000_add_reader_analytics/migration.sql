-- Phase 6: durable, privacy-conscious reader analytics ingestion.
CREATE TYPE "reader_analytics_event_type" AS ENUM (
  'story_view',
  'chapter_view',
  'reading_started',
  'reading_progress',
  'reading_completed'
);

CREATE TABLE "reader_analytics_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "event_id" UUID NOT NULL,
  "type" "reader_analytics_event_type" NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "viewer_key_hash" VARCHAR(64) NOT NULL,
  "session_id" UUID NOT NULL,
  "story_id" UUID NOT NULL,
  "chapter_id" UUID,
  "progress_percent" DECIMAL(5,2),
  "active_seconds" INTEGER,
  "occurred_at" TIMESTAMPTZ(3) NOT NULL,
  "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "queued_at" TIMESTAMPTZ(3),
  "processed_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reader_analytics_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reader_analytics_events_event_id_unique" UNIQUE ("event_id"),
  CONSTRAINT "reader_analytics_events_story_fkey" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "reader_analytics_events_chapter_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "reader_analytics_events_progress_valid" CHECK ("progress_percent" IS NULL OR ("progress_percent" >= 0 AND "progress_percent" <= 100)),
  CONSTRAINT "reader_analytics_events_active_seconds_valid" CHECK ("active_seconds" IS NULL OR ("active_seconds" >= 0 AND "active_seconds" <= 60)),
  CONSTRAINT "reader_analytics_events_version_valid" CHECK ("version" >= 1),
  CONSTRAINT "reader_analytics_events_context_valid" CHECK (
    ("type" = 'story_view' AND "chapter_id" IS NULL)
    OR
    ("type" <> 'story_view' AND "chapter_id" IS NOT NULL)
  )
);

CREATE INDEX "reader_analytics_events_processing_idx" ON "reader_analytics_events"("processed_at", "received_at");
CREATE INDEX "reader_analytics_events_story_occurred_idx" ON "reader_analytics_events"("story_id", "occurred_at");
CREATE INDEX "reader_analytics_events_chapter_occurred_idx" ON "reader_analytics_events"("chapter_id", "occurred_at");
CREATE INDEX "reader_analytics_events_viewer_occurred_idx" ON "reader_analytics_events"("viewer_key_hash", "occurred_at");
CREATE INDEX "reader_analytics_events_type_occurred_idx" ON "reader_analytics_events"("type", "occurred_at");
CREATE INDEX "reader_analytics_events_queue_recovery_idx" ON "reader_analytics_events"("queued_at", "received_at");

ALTER TABLE "story_daily_stats"
  ADD COLUMN "reading_start_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "completion_count" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "chapter_daily_stats"
  ADD COLUMN "reading_start_count" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "reader_analytics_started_session_unique"
  ON "reader_analytics_events"("session_id", "chapter_id")
  WHERE "type" = 'reading_started';

CREATE UNIQUE INDEX "reader_analytics_completed_session_unique"
  ON "reader_analytics_events"("session_id", "chapter_id")
  WHERE "type" = 'reading_completed';
