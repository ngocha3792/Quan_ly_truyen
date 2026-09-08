CREATE TABLE IF NOT EXISTS "comment_regions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "comment_id" UUID NOT NULL,
  "chapter_id" UUID NOT NULL,
  "media_asset_id" UUID NOT NULL,
  "x" DECIMAL(8,6) NOT NULL,
  "y" DECIMAL(8,6) NOT NULL,
  "width" DECIMAL(8,6) NOT NULL,
  "height" DECIMAL(8,6) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "comment_regions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "comment_regions_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE,
  CONSTRAINT "comment_regions_chapter_media_fkey" FOREIGN KEY ("chapter_id", "media_asset_id") REFERENCES "chapter_media"("chapter_id", "media_asset_id") ON DELETE CASCADE,
  CONSTRAINT "comment_regions_bounds_valid" CHECK (
    "x" >= 0 AND "y" >= 0 AND "width" > 0 AND "height" > 0
    AND "x" + "width" <= 1 AND "y" + "height" <= 1
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS "comment_regions_comment_id_key" ON "comment_regions"("comment_id");
CREATE INDEX IF NOT EXISTS "comment_regions_chapter_media_idx" ON "comment_regions"("chapter_id", "media_asset_id");
