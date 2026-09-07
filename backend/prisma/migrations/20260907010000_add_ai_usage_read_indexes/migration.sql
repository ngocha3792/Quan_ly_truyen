-- Sprint 9 read-side indexes for bounded usage aggregation by date,
-- connection, model, and protocol.
DROP INDEX IF EXISTS "ai_usages_connection_id_idx";

CREATE INDEX "ai_usages_created_at_idx"
  ON "ai_usages"("created_at");

CREATE INDEX "ai_usages_connection_id_created_at_idx"
  ON "ai_usages"("connection_id", "created_at");

CREATE INDEX "ai_usages_model_created_at_idx"
  ON "ai_usages"("model", "created_at");
