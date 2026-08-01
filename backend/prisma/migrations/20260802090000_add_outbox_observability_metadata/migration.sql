-- Transport metadata is separate from the business payload so trace and
-- correlation context can cross the transactional outbox boundary.
ALTER TABLE "outbox_events"
ADD COLUMN "metadata" JSONB;
