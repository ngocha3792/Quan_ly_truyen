ALTER TABLE "reader_analytics_events"
ADD COLUMN "user_id" UUID;

CREATE INDEX "reader_analytics_events_user_occurred_idx"
ON "reader_analytics_events"("user_id", "occurred_at");

ALTER TABLE "reader_analytics_events"
ADD CONSTRAINT "reader_analytics_events_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
