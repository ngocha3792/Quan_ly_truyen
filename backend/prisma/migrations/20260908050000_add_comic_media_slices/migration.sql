DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'media_slice_status') THEN
    CREATE TYPE "media_slice_status" AS ENUM ('pending', 'processing', 'ready', 'failed');
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS "chapter_media_slices" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "chapter_id" UUID NOT NULL,
  "media_asset_id" UUID NOT NULL,
  "slice_index" INTEGER NOT NULL,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "offset_y" INTEGER NOT NULL,
  "aspect_ratio" DECIMAL(10,6) NOT NULL,
  "processing_status" "media_slice_status" NOT NULL DEFAULT 'pending',
  "processing_error" VARCHAR(1000),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chapter_media_slices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chapter_media_slices_media_fkey"
    FOREIGN KEY ("chapter_id", "media_asset_id")
    REFERENCES "chapter_media"("chapter_id", "media_asset_id") ON DELETE CASCADE,
  CONSTRAINT "chapter_media_slices_dimensions_valid" CHECK (
    "slice_index" >= 0 AND "width" > 0 AND "height" > 0 AND "offset_y" >= 0
    AND "aspect_ratio" > 0
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS "chapter_media_slices_media_index_key"
  ON "chapter_media_slices"("chapter_id", "media_asset_id", "slice_index");
CREATE INDEX IF NOT EXISTS "chapter_media_slices_status_updated_idx"
  ON "chapter_media_slices"("processing_status", "updated_at");
