CREATE TYPE inbound_webhook_status AS ENUM (
    'pending',
    'processing',
    'processed',
    'ignored',
    'failed',
    'dead_letter'
);

UPDATE inbound_webhook_events
SET status = CASE
    WHEN status IN ('pending', 'processing', 'processed', 'ignored', 'failed', 'dead_letter') THEN status
    ELSE 'failed'
END;

ALTER TABLE inbound_webhook_events
    ALTER COLUMN status DROP DEFAULT,
    ALTER COLUMN status TYPE inbound_webhook_status
        USING status::inbound_webhook_status,
    ALTER COLUMN status SET DEFAULT 'pending',
    ADD COLUMN next_attempt_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN processing_started_at TIMESTAMPTZ(3);

ALTER TABLE media_assets
    ADD COLUMN processing_started_at TIMESTAMPTZ(3),
    ADD COLUMN delete_attempts INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN next_delete_attempt_at TIMESTAMPTZ(3),
    ADD COLUMN last_provider_error_code VARCHAR(120);

CREATE INDEX inbound_webhook_events_provider_status_next_attempt_at_idx
    ON inbound_webhook_events(provider, status, next_attempt_at);
CREATE INDEX media_assets_status_next_delete_attempt_at_idx
    ON media_assets(status, next_delete_attempt_at);
