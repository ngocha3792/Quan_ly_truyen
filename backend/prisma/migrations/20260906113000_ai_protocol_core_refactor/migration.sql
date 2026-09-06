-- Expand phase: introduce protocol/auth routing without breaking the old
-- application while the new release is rolling out. Legacy provider/key
-- columns stay populated for one compatibility release and can be removed by
-- a later contract migration.
CREATE TYPE "ai_protocol" AS ENUM (
  'openai_responses',
  'openai_chat_completions',
  'anthropic_messages',
  'gemini_generate_content'
);

CREATE TYPE "ai_auth_type" AS ENUM (
  'bearer',
  'x_api_key',
  'api_key_header',
  'query_param'
);

ALTER TABLE "ai_connections"
  ADD COLUMN "vendor_hint" VARCHAR(80),
  ADD COLUMN "protocol" "ai_protocol",
  ADD COLUMN "auth_type" "ai_auth_type",
  ADD COLUMN "auth_header_name" VARCHAR(120),
  ADD COLUMN "encrypted_credential" TEXT;

UPDATE "ai_connections"
SET
  "vendor_hint" = CASE "provider"::text
    WHEN 'gemini' THEN 'GEMINI'
    WHEN 'openai' THEN 'OPENAI'
    WHEN 'anthropic' THEN 'ANTHROPIC'
    WHEN 'openai_compatible' THEN 'OPENAI_COMPATIBLE'
  END,
  "protocol" = CASE "provider"::text
    WHEN 'gemini' THEN 'gemini_generate_content'::"ai_protocol"
    WHEN 'anthropic' THEN 'anthropic_messages'::"ai_protocol"
    ELSE 'openai_chat_completions'::"ai_protocol"
  END,
  "auth_type" = CASE "provider"::text
    WHEN 'gemini' THEN 'query_param'::"ai_auth_type"
    WHEN 'anthropic' THEN 'x_api_key'::"ai_auth_type"
    ELSE 'bearer'::"ai_auth_type"
  END,
  "auth_header_name" = CASE "provider"::text
    WHEN 'gemini' THEN 'key'
    WHEN 'anthropic' THEN 'x-api-key'
    ELSE NULL
  END,
  "encrypted_credential" = "encrypted_api_key",
  "base_url" = COALESCE(
    "base_url",
    CASE "provider"::text
      WHEN 'gemini' THEN 'https://generativelanguage.googleapis.com/v1beta'
      WHEN 'openai' THEN 'https://api.openai.com/v1'
      WHEN 'anthropic' THEN 'https://api.anthropic.com/v1'
      ELSE NULL
    END
  );

-- A malformed legacy compatible row must never fall back to the official
-- OpenAI endpoint, because that could send its credential to the wrong host.
UPDATE "ai_connections"
SET "enabled" = false
WHERE "provider"::text = 'openai_compatible'
  AND "base_url" IS NULL;

ALTER TABLE "ai_conversations"
  ADD COLUMN "vendor_hint" VARCHAR(80),
  ADD COLUMN "protocol" "ai_protocol";

UPDATE "ai_conversations"
SET
  "vendor_hint" = CASE "provider"::text
    WHEN 'gemini' THEN 'GEMINI'
    WHEN 'openai' THEN 'OPENAI'
    WHEN 'anthropic' THEN 'ANTHROPIC'
    WHEN 'openai_compatible' THEN 'OPENAI_COMPATIBLE'
  END,
  "protocol" = CASE "provider"::text
    WHEN 'gemini' THEN 'gemini_generate_content'::"ai_protocol"
    WHEN 'anthropic' THEN 'anthropic_messages'::"ai_protocol"
    ELSE 'openai_chat_completions'::"ai_protocol"
  END;

ALTER TABLE "ai_usages"
  ADD COLUMN "protocol" "ai_protocol";

UPDATE "ai_usages"
SET "protocol" = CASE "provider"::text
  WHEN 'gemini' THEN 'gemini_generate_content'::"ai_protocol"
  WHEN 'anthropic' THEN 'anthropic_messages'::"ai_protocol"
  ELSE 'openai_chat_completions'::"ai_protocol"
END;

-- Keep the legacy provider index during the expand phase because an older app
-- instance can still query that column while a rolling deployment is active.
CREATE INDEX "ai_connections_protocol_idx"
  ON "ai_connections"("protocol");
CREATE INDEX "ai_usages_protocol_created_at_idx"
  ON "ai_usages"("protocol", "created_at");
