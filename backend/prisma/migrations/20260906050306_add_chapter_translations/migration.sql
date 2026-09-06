-- CreateEnum
CREATE TYPE "chapter_translation_status" AS ENUM ('pending', 'processing', 'completed', 'failed');

-- CreateTable
CREATE TABLE "chapter_translations" (
    "id" UUID NOT NULL,
    "chapter_id" UUID NOT NULL,
    "target_language_code" VARCHAR(10) NOT NULL,
    "requested_by_id" UUID NOT NULL,
    "connection_id" UUID,
    "status" "chapter_translation_status" NOT NULL DEFAULT 'pending',
    "source_content_hash" VARCHAR(64) NOT NULL,
    "translated_title" VARCHAR(255),
    "translated_content" TEXT,
    "error_code" VARCHAR(50),
    "error_message" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "chapter_translations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chapter_translations_status_idx" ON "chapter_translations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "chapter_translations_chapter_id_target_language_code_key" ON "chapter_translations"("chapter_id", "target_language_code");

-- AddForeignKey
ALTER TABLE "chapter_translations" ADD CONSTRAINT "chapter_translations_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_translations" ADD CONSTRAINT "chapter_translations_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_translations" ADD CONSTRAINT "chapter_translations_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "ai_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
