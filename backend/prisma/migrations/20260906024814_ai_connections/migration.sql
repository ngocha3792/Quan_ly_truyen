-- AlterEnum
ALTER TYPE "ai_provider" ADD VALUE 'openai_compatible';

-- Rename ai_api_keys -> ai_connections (preserve existing rows, don't drop/recreate)
ALTER TABLE "ai_api_keys" RENAME TO "ai_connections";
ALTER TABLE "ai_connections" RENAME CONSTRAINT "ai_api_keys_pkey" TO "ai_connections_pkey";
ALTER TABLE "ai_connections" RENAME CONSTRAINT "ai_api_keys_user_id_fkey" TO "ai_connections_user_id_fkey";
ALTER TABLE "ai_connections" RENAME COLUMN "encrypted_key" TO "encrypted_api_key";

-- Drop the old "one key per provider per user" constraint; multiple connections per provider are now allowed
DROP INDEX "ai_api_keys_user_id_provider_key";

-- New AiConnection columns
ALTER TABLE "ai_connections" ADD COLUMN "name" VARCHAR(120) NOT NULL DEFAULT '';
ALTER TABLE "ai_connections" ALTER COLUMN "name" DROP DEFAULT;
ALTER TABLE "ai_connections" ADD COLUMN "base_url" TEXT;
ALTER TABLE "ai_connections" ADD COLUMN "default_model" VARCHAR(200);
ALTER TABLE "ai_connections" ADD COLUMN "enabled" BOOLEAN NOT NULL DEFAULT true;

-- New indexes to replace the dropped composite unique index
CREATE INDEX "ai_connections_user_id_idx" ON "ai_connections"("user_id");
CREATE INDEX "ai_connections_provider_idx" ON "ai_connections"("provider");

-- AiConversation gains an optional link to the connection it was created with
ALTER TABLE "ai_conversations" ADD COLUMN "connection_id" UUID;
CREATE INDEX "ai_conversations_connection_id_idx" ON "ai_conversations"("connection_id");
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "ai_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
