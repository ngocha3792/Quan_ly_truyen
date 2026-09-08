DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'comment_anchor_status') THEN
    CREATE TYPE "comment_anchor_status" AS ENUM ('active', 'reanchored', 'orphaned');
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS "comment_anchors" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "comment_id" UUID NOT NULL,
  "chapter_id" UUID NOT NULL,
  "chapter_version" INTEGER NOT NULL,
  "last_verified_version" INTEGER NOT NULL,
  "status" "comment_anchor_status" NOT NULL DEFAULT 'active',
  "start_block_id" UUID NOT NULL,
  "start_offset" INTEGER NOT NULL,
  "end_block_id" UUID NOT NULL,
  "end_offset" INTEGER NOT NULL,
  "quote_text" TEXT NOT NULL,
  "quote_hash" VARCHAR(64) NOT NULL,
  "excerpt_before" VARCHAR(200),
  "excerpt_after" VARCHAR(200),
  "reanchored_at" TIMESTAMPTZ(3),
  "reanchored_from_version" INTEGER,
  "orphaned_at" TIMESTAMPTZ(3),
  "orphaned_reason" VARCHAR(500),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "comment_anchors_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "comment_anchors_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE,
  CONSTRAINT "comment_anchors_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE CASCADE,
  CONSTRAINT "comment_anchors_range_valid" CHECK (
    "chapter_version" > 0 AND "last_verified_version" > 0
    AND "start_offset" >= 0 AND "end_offset" >= 0
    AND length("quote_hash") = 64
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS "comment_anchors_comment_id_key" ON "comment_anchors"("comment_id");
CREATE INDEX IF NOT EXISTS "comment_anchors_chapter_id_status_idx" ON "comment_anchors"("chapter_id", "status");
CREATE INDEX IF NOT EXISTS "comment_anchors_chapter_id_start_block_id_idx" ON "comment_anchors"("chapter_id", "start_block_id");
CREATE INDEX IF NOT EXISTS "comment_anchors_status_last_verified_version_idx" ON "comment_anchors"("status", "last_verified_version");
CREATE INDEX IF NOT EXISTS "comment_anchors_quote_hash_idx" ON "comment_anchors"("quote_hash");
