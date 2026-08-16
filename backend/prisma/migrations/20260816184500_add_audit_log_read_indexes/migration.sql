-- Phase 4: read-side indexes only. Audit payload JSON remains unindexed.
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx"
ON "audit_logs"("created_at");

CREATE INDEX IF NOT EXISTS "audit_logs_action_created_at_idx"
ON "audit_logs"("action", "created_at");

CREATE INDEX IF NOT EXISTS "audit_logs_request_id_created_at_idx"
ON "audit_logs"("request_id", "created_at");
