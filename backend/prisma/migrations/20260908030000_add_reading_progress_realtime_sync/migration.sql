-- Sprint 1: optimistic, idempotent cross-device reading progress sync.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reading_cursor_type') THEN
    CREATE TYPE "reading_cursor_type" AS ENUM ('text', 'comic');
  END IF;
END;
$$;

ALTER TABLE "reading_progress"
  ADD COLUMN IF NOT EXISTS "cursor_type" "reading_cursor_type",
  ADD COLUMN IF NOT EXISTS "block_id" UUID,
  ADD COLUMN IF NOT EXISTS "character_offset" INTEGER,
  ADD COLUMN IF NOT EXISTS "media_asset_id" UUID,
  ADD COLUMN IF NOT EXISTS "slice_id" UUID,
  ADD COLUMN IF NOT EXISTS "relative_y" DECIMAL(6, 5),
  ADD COLUMN IF NOT EXISTS "revision" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "device_id" UUID,
  ADD COLUMN IF NOT EXISTS "client_event_id" UUID,
  ADD COLUMN IF NOT EXISTS "last_server_sequence" BIGINT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "reading_progress_sync_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "story_id" UUID NOT NULL,
  "client_event_id" UUID NOT NULL,
  "device_id" UUID NOT NULL,
  "base_revision" INTEGER NOT NULL,
  "applied_revision" INTEGER NOT NULL,
  "server_sequence" BIGSERIAL NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reading_progress_sync_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reading_progress_sync_events_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "reading_progress_sync_events_story_id_fkey"
    FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "reading_progress_sync_events_user_id_client_event_id_key"
  ON "reading_progress_sync_events"("user_id", "client_event_id");
CREATE UNIQUE INDEX IF NOT EXISTS "reading_progress_sync_events_server_sequence_key"
  ON "reading_progress_sync_events"("server_sequence");
CREATE INDEX IF NOT EXISTS "reading_progress_sync_events_user_id_story_id_server_sequence_idx"
  ON "reading_progress_sync_events"("user_id", "story_id", "server_sequence");
CREATE INDEX IF NOT EXISTS "reading_progress_user_id_device_id_idx"
  ON "reading_progress"("user_id", "device_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reading_progress_realtime_cursor_valid'
      AND conrelid = 'reading_progress'::regclass
  ) THEN
    ALTER TABLE "reading_progress"
      ADD CONSTRAINT "reading_progress_realtime_cursor_valid" CHECK (
        "revision" >= 0
        AND "last_server_sequence" >= 0
        AND ("character_offset" IS NULL OR "character_offset" >= 0)
        AND ("relative_y" IS NULL OR "relative_y" BETWEEN 0 AND 1)
        AND (
          "cursor_type" IS NULL
          OR (
            "cursor_type" = 'text'
            AND "block_id" IS NOT NULL
            AND "character_offset" IS NOT NULL
            AND "media_asset_id" IS NULL
            AND "slice_id" IS NULL
            AND "relative_y" IS NULL
          )
          OR (
            "cursor_type" = 'comic'
            AND ("media_asset_id" IS NOT NULL OR "slice_id" IS NOT NULL)
            AND "relative_y" IS NOT NULL
            AND "block_id" IS NULL
            AND "character_offset" IS NULL
          )
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reading_progress_sync_events_revision_valid'
      AND conrelid = 'reading_progress_sync_events'::regclass
  ) THEN
    ALTER TABLE "reading_progress_sync_events"
      ADD CONSTRAINT "reading_progress_sync_events_revision_valid"
      CHECK ("base_revision" >= 0 AND "applied_revision" > "base_revision");
  END IF;
END;
$$;
