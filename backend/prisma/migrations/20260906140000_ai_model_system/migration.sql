ALTER TABLE "ai_conversations"
  ADD COLUMN "model_id" VARCHAR(200);

COMMENT ON COLUMN "ai_conversations"."model_id" IS
  'Explicit model selected for this conversation; NULL uses profile/connection/protocol defaults.';
