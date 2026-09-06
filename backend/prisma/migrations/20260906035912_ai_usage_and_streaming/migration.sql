-- CreateEnum
CREATE TYPE "ai_usage_capability" AS ENUM ('chat', 'translate', 'summary', 'rewrite');

-- CreateTable
CREATE TABLE "ai_usages" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "connection_id" UUID,
    "provider" "ai_provider" NOT NULL,
    "model" VARCHAR(200) NOT NULL,
    "capability" "ai_usage_capability" NOT NULL DEFAULT 'chat',
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "latency_ms" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL,
    "error_code" VARCHAR(50),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_usages_user_id_created_at_idx" ON "ai_usages"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_usages_connection_id_idx" ON "ai_usages"("connection_id");

-- AddForeignKey
ALTER TABLE "ai_usages" ADD CONSTRAINT "ai_usages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usages" ADD CONSTRAINT "ai_usages_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "ai_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
