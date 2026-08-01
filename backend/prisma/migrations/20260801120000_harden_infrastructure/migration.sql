ALTER TABLE outbox_events
    ADD COLUMN processing_started_at TIMESTAMPTZ(3);

CREATE INDEX outbox_events_status_processing_started_at_idx
    ON outbox_events(status, processing_started_at);
