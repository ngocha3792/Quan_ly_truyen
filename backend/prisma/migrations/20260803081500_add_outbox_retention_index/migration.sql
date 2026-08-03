CREATE INDEX
  "outbox_events_retention_idx"
ON
  "outbox_events" (
    "aggregate_type",
    "event_type",
    "status",
    "processed_at"
  );