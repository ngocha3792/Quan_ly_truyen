-- A nullable unique business key prevents duplicate outbox rows when a
-- transaction is retried. PostgreSQL permits multiple NULL values here.
ALTER TABLE "outbox_events"
ADD COLUMN "idempotency_key" VARCHAR(200);

CREATE UNIQUE INDEX "outbox_events_idempotency_key_key"
ON "outbox_events"("idempotency_key");
