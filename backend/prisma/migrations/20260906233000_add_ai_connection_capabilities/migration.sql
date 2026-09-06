ALTER TABLE "ai_connections"
ADD COLUMN "capability_model" VARCHAR(200),
ADD COLUMN "supports_chat" BOOLEAN,
ADD COLUMN "supports_model_discovery" BOOLEAN,
ADD COLUMN "supports_streaming" BOOLEAN,
ADD COLUMN "supports_system_prompt" BOOLEAN,
ADD COLUMN "supports_tools" BOOLEAN,
ADD COLUMN "supports_vision" BOOLEAN,
ADD COLUMN "supports_reasoning" BOOLEAN,
ADD COLUMN "capabilities_probed_at" TIMESTAMPTZ(3);
