-- PostgreSQL truncates identifiers to 63 bytes. The original Sprint 1 index
-- name was 65 bytes, so normalize it to the explicit Prisma/production name.
DO $$
BEGIN
  IF to_regclass('reading_progress_sync_user_story_sequence_idx') IS NULL THEN
    IF to_regclass('reading_progress_sync_events_user_id_story_id_server_sequence_i') IS NOT NULL THEN
      ALTER INDEX "reading_progress_sync_events_user_id_story_id_server_sequence_i"
        RENAME TO "reading_progress_sync_user_story_sequence_idx";
    ELSE
      CREATE INDEX "reading_progress_sync_user_story_sequence_idx"
        ON "reading_progress_sync_events"("user_id", "story_id", "server_sequence");
    END IF;
  END IF;
END;
$$;
