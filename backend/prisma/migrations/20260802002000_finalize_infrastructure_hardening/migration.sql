ALTER TABLE "outbox_events"
    ADD COLUMN "processing_token" UUID;

-- Claims created before ownership tokens existed cannot be finalized safely.
UPDATE "outbox_events"
SET
    "status" = 'pending',
    "processing_started_at" = NULL,
    "processing_token" = NULL,
    "available_at" = CURRENT_TIMESTAMP,
    "processed_at" = NULL,
    "last_error" = 'Recovered PROCESSING event during infrastructure migration'
WHERE "status" = 'processing';
