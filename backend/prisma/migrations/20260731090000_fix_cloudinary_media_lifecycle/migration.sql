-- CreateTable
CREATE TABLE inbound_webhook_events (
    id UUID NOT NULL,
    provider VARCHAR(50) NOT NULL,
    event_key VARCHAR(255) NOT NULL,
    payload_hash VARCHAR(64) NOT NULL,
    event_type VARCHAR(120),
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    payload JSONB NOT NULL,
    received_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMPTZ(3),
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    CONSTRAINT inbound_webhook_events_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX inbound_webhook_events_provider_event_key_key ON inbound_webhook_events(provider, event_key);
CREATE INDEX inbound_webhook_events_provider_status_received_at_idx ON inbound_webhook_events(provider, status, received_at);
