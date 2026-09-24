-- CreateEnum
CREATE TYPE "chapter_media_ocr_status" AS ENUM ('pending', 'processing', 'completed', 'failed');

-- CreateTable
CREATE TABLE "chapter_media_ocr" (
    "id" UUID NOT NULL,
    "chapter_id" UUID NOT NULL,
    "media_asset_id" UUID NOT NULL,
    "language" VARCHAR(16) NOT NULL,
    "status" "chapter_media_ocr_status" NOT NULL DEFAULT 'pending',
    "text" TEXT,
    "lines" JSONB,
    "line_count" INTEGER NOT NULL DEFAULT 0,
    "failure_reason" VARCHAR(1000),
    "requested_by_id" UUID NOT NULL,
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "chapter_media_ocr_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "chapter_media_ocr_page_language_key" ON "chapter_media_ocr"("chapter_id", "media_asset_id", "language");

-- CreateIndex
CREATE INDEX "chapter_media_ocr_chapter_status_idx" ON "chapter_media_ocr"("chapter_id", "status");

-- CreateIndex
CREATE INDEX "chapter_media_ocr_status_updated_idx" ON "chapter_media_ocr"("status", "updated_at");

-- CreateIndex
CREATE INDEX "chapter_media_ocr_requested_by_idx" ON "chapter_media_ocr"("requested_by_id");

-- AddForeignKey
ALTER TABLE "chapter_media_ocr" ADD CONSTRAINT "chapter_media_ocr_chapter_id_media_asset_id_fkey" FOREIGN KEY ("chapter_id", "media_asset_id") REFERENCES "chapter_media"("chapter_id", "media_asset_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_media_ocr" ADD CONSTRAINT "chapter_media_ocr_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
