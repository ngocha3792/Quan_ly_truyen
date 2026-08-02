-- CreateTable
CREATE TABLE "chapter_media" (
    "chapter_id" UUID NOT NULL,
    "media_asset_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "alt_text" VARCHAR(500),
    "caption" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chapter_media_pkey" PRIMARY KEY ("chapter_id","media_asset_id")
);

-- CreateIndex
CREATE INDEX "chapter_media_media_asset_id_idx" ON "chapter_media"("media_asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "chapter_media_chapter_id_sort_order_key" ON "chapter_media"("chapter_id", "sort_order");

-- AddForeignKey
ALTER TABLE "chapter_media" ADD CONSTRAINT "chapter_media_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_media" ADD CONSTRAINT "chapter_media_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
